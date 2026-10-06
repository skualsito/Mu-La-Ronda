// <copyright file="ResetCharacterNpcPlugin.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.Resets;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.NPC;
using MUnique.OpenMU.GameLogic.PlugIns;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Action to reset a character.
/// </summary>
[Guid("08953BE6-DABF-49CC-A500-FDB9DC2C4D80")]
[PlugIn]
[Display(Name = nameof(PlugInResources.ResetCharacterNpcPlugin_Name), Description = nameof(PlugInResources.ResetCharacterNpcPlugin_Description), ResourceType = typeof(PlugInResources))]
public class ResetCharacterNpcPlugin : IPlayerTalkToNpcPlugIn
{
    /// <summary>
    /// Gets the reset NPC number of 'Leo the Helper'.
    /// </summary>
    public static short ResetNpcNumber => 371;

    /// <inheritdoc />
    public async ValueTask PlayerTalksToNpcAsync(Player player, NonPlayerCharacter npc, NpcTalkEventArgs eventArgs)
    {
        if (npc.Definition.Number != ResetNpcNumber)
        {
            return;
        }

        eventArgs.HasBeenHandled = true;
        var resetAction = new ResetCharacterAction(player, npc);
        await resetAction.ResetCharacterAsync().ConfigureAwait(false);

        // Mu La Ronda: with ResetConfiguration.LogOut the reset has already sent
        // the player back to the character selection. TalkNpcAction would then
        // advance it to EnteredWorld (allowed from CharacterSelection), and the
        // next SelectCharacter is refused for the wrong state and disconnects:
        // the client was left on the old map without its character. Leaving the
        // "dialog open" makes TalkNpcAction keep its hands off the state.
        if (player.PlayerState.CurrentState == PlayerState.CharacterSelection)
        {
            player.OpenedNpc = null;
            eventArgs.LeavesDialogOpen = true;
        }
    }
}