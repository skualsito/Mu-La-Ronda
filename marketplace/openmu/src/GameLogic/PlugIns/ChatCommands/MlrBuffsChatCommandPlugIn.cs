// <copyright file="MlrBuffsChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;

using System.Globalization;
using System.Runtime.InteropServices;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /buffs answers the buff bar's tooltips (src/skills/buffs.ts) with the seconds each
/// of the character's effects has left - the game sends the effects but never their time. One blue
/// line "Buffs: effect=seconds;..." the client reads instead of showing; -1 for one that lasts.
/// </summary>
[Guid("5B7D2E94-1C6A-4F38-A2E5-9D0B4C7F1E36")]
[PlugIn]
[Display(Name = "/buffs", Description = "Sends the time left of the character's effects to the client's buff bar.")]
[ChatCommandHelp(Command, "Sends the time left of your effects (the buff bar shows it).", null)]
public class MlrBuffsChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/buffs";

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var now = DateTime.UtcNow;
        var entries = (await player.MagicEffectList.GetActiveEffectsSnapshotAsync().ConfigureAwait(false))
            .Where(effect => effect.Definition.InformObservers)
            .Take(30)
            .Select(effect => string.Create(
                CultureInfo.InvariantCulture,
                $"{effect.Id}={(effect.EndsAt is { } end ? Math.Max(0, (int)Math.Ceiling((end - now).TotalSeconds)) : -1)};"));
        await player.ShowBlueMessageAsync("Buffs: " + string.Concat(entries)).ConfigureAwait(false);
    }
}
