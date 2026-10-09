// <copyright file="SaveOwner.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.Persistence;

using System.Threading;

/// <summary>
/// Mu La Ronda: whose progress a save is for, set by the game logic before it saves
/// (PlayerPersistence), so a refused row can be told apart by player in the log
/// (EntityFrameworkContextBase).
/// </summary>
public static class SaveOwner
{
    /// <summary>Gets the owner of the save running on this flow.</summary>
    public static AsyncLocal<string?> Current { get; } = new();
}
