// <copyright file="ResetMasterTreeChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;

using System.Runtime.InteropServices;
using MUnique.OpenMU.GameLogic.PlayerActions;
using MUnique.OpenMU.GameLogic.Views.Login;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /resetarbol takes back every point put into the master skill tree, to place them
/// again after a mistake. Each master skill's level is the points it took (AddMasterPointAction:
/// its minimum level to learn it, then one per level), so the refund is their sum. The player goes
/// back to the character selection: on entering again the skill list, the passive bonuses and
/// the tree are built from scratch.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C29")]
[PlugIn]
[Display(Name = "/resetarbol", Description = "Resets the master skill tree and refunds its points.")]
[ChatCommandHelp(Command, CharacterStatus.Normal)]
public class ResetMasterTreeChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/resetarbol";

    private readonly LogoutAction _logoutAction = new();

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        var character = player.SelectedCharacter;
        if (character is null || player.PlayerState.CurrentState != PlayerState.EnteredWorld)
        {
            return;
        }

        if (character.CharacterClass?.IsMasterClass != true)
        {
            await player.ShowBlueMessageAsync("Arbol de skills: solo para personajes con clase master.").ConfigureAwait(false);
            return;
        }

        if (player.CurrentMiniGame is not null)
        {
            await player.ShowBlueMessageAsync("Arbol de skills: no se puede reiniciar dentro de un evento.").ConfigureAwait(false);
            return;
        }

        var masterSkills = character.LearnedSkills.Where(s => s.Skill?.MasterDefinition is not null).ToList();
        if (masterSkills.Count == 0)
        {
            await player.ShowBlueMessageAsync("Arbol de skills: no tenes puntos puestos.").ConfigureAwait(false);
            return;
        }

        var refund = masterSkills.Sum(s => s.Level);
        foreach (var entry in masterSkills)
        {
            character.LearnedSkills.Remove(entry);
            await player.PersistenceContext.DeleteAsync(entry).ConfigureAwait(false);
        }

        character.MasterLevelUpPoints += refund;
        player.Logger.LogInformation("Master tree reset for {0}: {1} skills, {2} points back", character.Name, masterSkills.Count, refund);

        await player.ShowBlueMessageAsync($"Arbol de skills reiniciado: {refund} puntos devueltos. Volve a entrar con el personaje.").ConfigureAwait(false);
        await this._logoutAction.LogoutAsync(player, LogoutType.BackToCharacterSelection).ConfigureAwait(false);
    }
}
