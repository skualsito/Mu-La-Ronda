// <copyright file="GrandResetPlugIns.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.GrandReset;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.NPC;
using MUnique.OpenMU.GameLogic.PlugIns;
using MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /grandreset answers the grand reset window (GrandReset.StatusLine);
/// /grandreset confirmar does it, by the NPC.
/// </summary>
[Guid("E2B7C4D1-6A3F-4E58-9B0C-1D2E3F4A5B6D")]
[PlugIn]
[Display(Name = "/grandreset", Description = "Shows the grand reset state, or does it by the NPC.")]
[ChatCommandHelp(Command, "Shows your grand resets and coins; /grandreset confirmar does it by the NPC.", null)]
public class GrandResetChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/grandreset";

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var argument = command.Length > Command.Length ? command[Command.Length..].Trim() : string.Empty;
        if (argument.Equals("confirmar", StringComparison.OrdinalIgnoreCase))
        {
            // Like the reset by Leo: not inside the persistence lock, the logout at the end saves.
            await GrandResetAction.TryAsync(player).ConfigureAwait(false);
            return;
        }

        await player.ShowBlueMessageAsync(GrandReset.StatusLine(player)).ConfigureAwait(false);
    }
}

/// <summary>
/// Mu La Ronda: /grandshop &lt;id&gt; buys an item of the grand reset shop with coins, by the NPC.
/// </summary>
[Guid("E2B7C4D1-6A3F-4E58-9B0C-1D2E3F4A5B6E")]
[PlugIn]
[Display(Name = "/grandshop", Description = "Buys an item of the grand reset shop with grand reset coins.")]
[ChatCommandHelp(Command, "Buys an item of the grand reset shop: /grandshop <number>.", null)]
public class GrandShopChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/grandshop";

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var argument = command.Length > Command.Length ? command[Command.Length..].Trim() : string.Empty;
        if (!int.TryParse(argument, out var id))
        {
            await player.ShowBlueMessageAsync("Tienda Grand Reset: elegi un item en la ventana del NPC de Grand Reset.").ConfigureAwait(false);
            return;
        }

        await GrandShop.BuyAsync(player, id).ConfigureAwait(false);
    }
}

/// <summary>
/// Mu La Ronda: talking to the Grand Reset NPC answers with the state; the client opens its own
/// window for it (src/common/grandReset.ts) and does not send the talk, so this is for any other.
/// </summary>
[Guid("E2B7C4D1-6A3F-4E58-9B0C-1D2E3F4A5B6F")]
[PlugIn]
[Display(Name = "Grand reset NPC", Description = "The Grand Reset NPC answers with the grand reset state.")]
public class GrandResetNpcPlugIn : IPlayerTalkToNpcPlugIn
{
    /// <inheritdoc />
    public async ValueTask PlayerTalksToNpcAsync(Player player, NonPlayerCharacter npc, NpcTalkEventArgs eventArgs)
    {
        if (npc.Definition.Number != GrandReset.NpcNumber)
        {
            return;
        }

        eventArgs.HasBeenHandled = true;
        await player.ShowBlueMessageAsync(GrandReset.StatusLine(player)).ConfigureAwait(false);
    }
}
