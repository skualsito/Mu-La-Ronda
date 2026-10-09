// <copyright file="StartEventChatCommandPlugIns.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlugIns.InvasionEvents;
using MUnique.OpenMU.GameLogic.PlugIns.PeriodicTasks;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /startkanturu opens the Kanturu Refinery Tower entrance now, like /startbc
/// does for Blood Castle - for a GM to run or test the event outside its timetable.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C27")]
[PlugIn]
[Display(Name = "/startkanturu", Description = "Starts the Kanturu event now.")]
[ChatCommandHelp(Command, CharacterStatus.GameMaster)]
public class StartKanturuEventChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/startkanturu";

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.GameMaster;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var kanturu = player.GameContext.PlugInManager.GetStrategy<MiniGameType, IPeriodicMiniGameStartPlugIn>(MiniGameType.Kanturu);
        if (kanturu is null)
        {
            await player.ShowBlueMessageAsync("Kanturu: el evento no esta activo (plugin KanturuStartPlugIn).").ConfigureAwait(false);
            return;
        }

        // Without the event's definition (OpenMU update "Add Kanturu data") the Gateway Machine
        // answers nothing at all (KanturuGatewayPlugIn), so the start would look fine and do nothing.
        if (!player.GameContext.Configuration.MiniGameDefinitions.Any(d => d.Type == MiniGameType.Kanturu))
        {
            await player.ShowBlueMessageAsync("Kanturu: falta instalar el evento (panel de OpenMU, Updates: Add Kanturu data).").ConfigureAwait(false);
            return;
        }

        kanturu.ForceStart();
        await player.ShowBlueMessageAsync("Kanturu: evento iniciado.").ConfigureAwait(false);
    }
}

/// <summary>
/// Mu La Ronda: /startgolden starts the golden invasion now.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C28")]
[PlugIn]
[Display(Name = "/startgolden", Description = "Starts the golden invasion now.")]
[ChatCommandHelp(Command, CharacterStatus.GameMaster)]
public class StartGoldenInvasionChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/startgolden";

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.GameMaster;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var golden = player.GameContext.PlugInManager.GetActivePlugInsOf<IPeriodicTaskPlugIn>().OfType<GoldenInvasionPlugIn>().FirstOrDefault();
        if (golden is null)
        {
            await player.ShowBlueMessageAsync("Invasion dorada: el plugin no esta activo.").ConfigureAwait(false);
            return;
        }

        golden.ForceStart();
        await player.ShowBlueMessageAsync("Invasion dorada: iniciada.").ConfigureAwait(false);
    }
}
