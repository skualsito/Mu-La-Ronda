// <copyright file="ChangePasswordChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;

using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /cambiarclave &lt;actual&gt; &lt;nueva&gt; changes the account's password from inside
/// the game. The client sends it from the options window (General); it is never written to the chat
/// log there, and the proxy's tracker blanks its arguments. The new password follows the signup
/// rules (src/common/registerRules.ts): 4 to 10 printable ASCII characters, no spaces - the login
/// packet carries ten bytes.
/// </summary>
[Guid("2C7D9E41-6A8B-4F3C-B1D5-0E9F8A7B6C2B")]
[PlugIn]
[Display(Name = "/cambiarclave", Description = "Changes the account password.")]
public class ChangePasswordChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/cambiarclave";

    private static readonly Regex PasswordPattern = new("^[!-~]{4,10}$", RegexOptions.Compiled);

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        if (player.Account is not { } account || player.IsTemplatePlayer)
        {
            return;
        }

        var arguments = command.Length > Command.Length
            ? command[Command.Length..].Split(' ', StringSplitOptions.RemoveEmptyEntries)
            : [];
        if (arguments.Length != 2)
        {
            await player.ShowBlueMessageAsync("Cambiar clave: falta la clave actual o la nueva.").ConfigureAwait(false);
            return;
        }

        if (!BCrypt.Net.BCrypt.Verify(arguments[0], account.PasswordHash))
        {
            player.Logger.LogInformation("Password change refused for account {0}: wrong current password", account.LoginName);
            await player.ShowBlueMessageAsync("Cambiar clave: la clave actual no es correcta.").ConfigureAwait(false);
            return;
        }

        if (!PasswordPattern.IsMatch(arguments[1]))
        {
            await player.ShowBlueMessageAsync("Cambiar clave: la nueva tiene que tener de 4 a 10 letras, numeros o simbolos, sin espacios.").ConfigureAwait(false);
            return;
        }

        account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(arguments[1]);
        await player.SaveProgressAsync().ConfigureAwait(false);
        player.Logger.LogInformation("Password changed for account {0}", account.LoginName);
        await player.ShowBlueMessageAsync("Cambiar clave: listo, tu clave nueva ya funciona.").ConfigureAwait(false);
    }
}
