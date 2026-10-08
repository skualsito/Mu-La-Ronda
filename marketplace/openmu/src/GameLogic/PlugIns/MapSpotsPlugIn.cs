// <copyright file="MapSpotsPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns;

using System.Runtime.InteropServices;
using System.Text;
using MUnique.OpenMU.GameLogic.Attributes;
using MUnique.OpenMU.GameLogic.Offline;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: tells a player who arrives on a map where its monster spots are, for the TAB map
/// (src/common/mapSpots.ts). The spots are the map's monster spawn areas (the ones the admin
/// panel edits), the areas of one monster close to each other taken as one. They go as blue
/// lines the client reads and does not show: "Spots {map}|{part}/{parts}|x,y,monster,level,count;...".
/// </summary>
[PlugIn]
[Display(Name = "Map spots", Description = "Sends the monster spots of the map to a player who enters it, for the client's TAB map.")]
[Guid("6C1F6A0E-3B8D-4F0B-9E57-2B7C1D4A9F32")]
public class MapSpotsPlugIn : IObjectAddedToMapPlugIn
{
    /// <summary>Areas of the same monster whose centers are at most this many cells apart (per axis) are one spot.</summary>
    private const int MergeDistance = 10;

    /// <summary>The longest list of spots one line carries.</summary>
    private const int MaxLineLength = 180;

    /// <inheritdoc />
    public async ValueTask ObjectAddedToMapAsync(GameMap map, ILocateable addedObject)
    {
        if (addedObject is not Player player || player is OfflinePlayer || player.SelectedCharacter is null)
        {
            return;
        }

        var spots = new List<Spot>();
        foreach (var area in map.Definition.MonsterSpawns)
        {
            if (area.MonsterDefinition is not { ObjectKind: NpcObjectKind.Monster } monster
                || area.SpawnTrigger != SpawnTrigger.Automatic
                || area.Quantity <= 0)
            {
                continue;
            }

            var x = (area.X1 + area.X2) / 2;
            var y = (area.Y1 + area.Y2) / 2;
            var near = spots.FirstOrDefault(s => s.Number == monster.Number
                                                 && Math.Abs(s.X - x) <= MergeDistance
                                                 && Math.Abs(s.Y - y) <= MergeDistance);
            if (near is not null)
            {
                near.Add(x, y, area.Quantity);
                continue;
            }

            var level = monster.Attributes.FirstOrDefault(a => a.AttributeDefinition == Stats.Level)?.Value ?? 0;
            spots.Add(new Spot(monster.Number, (int)level, x, y, area.Quantity));
        }

        var lines = new List<string>();
        var line = new StringBuilder();
        foreach (var spot in spots)
        {
            var entry = $"{spot.X},{spot.Y},{spot.Number},{spot.Level},{spot.Count}";
            if (line.Length > 0 && line.Length + entry.Length + 1 > MaxLineLength)
            {
                lines.Add(line.ToString());
                line.Clear();
            }

            if (line.Length > 0)
            {
                line.Append(';');
            }

            line.Append(entry);
        }

        if (line.Length > 0 || lines.Count == 0)
        {
            lines.Add(line.ToString());
        }

        var mapNumber = map.MapId;
        for (var i = 0; i < lines.Count; i++)
        {
            await player.ShowBlueMessageAsync($"Spots {mapNumber}|{i + 1}/{lines.Count}|{lines[i]}").ConfigureAwait(false);
        }
    }

    private sealed class Spot
    {
        private int _sumX;
        private int _sumY;
        private int _areas;

        public Spot(short number, int level, int x, int y, int count)
        {
            this.Number = number;
            this.Level = level;
            this._sumX = x;
            this._sumY = y;
            this._areas = 1;
            this.Count = count;
        }

        public short Number { get; }

        public int Level { get; }

        public int Count { get; private set; }

        public int X => this._sumX / this._areas;

        public int Y => this._sumY / this._areas;

        public void Add(int x, int y, int count)
        {
            this._sumX += x;
            this._sumY += y;
            this._areas++;
            this.Count += count;
        }
    }
}
