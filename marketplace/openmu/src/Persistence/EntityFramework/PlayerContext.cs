// <copyright file="PlayerContext.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.Persistence.EntityFramework;

using System.Threading;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MUnique.OpenMU.Persistence.EntityFramework.Model;

/// <summary>
/// Persistence context which is used by in-game players.
/// </summary>
internal class PlayerContext : CachingEntityFrameworkContext, IPlayerContext
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PlayerContext" /> class.
    /// </summary>
    /// <param name="context">The context.</param>
    /// <param name="repositoryProvider">The repository provider.</param>
    /// <param name="logger">The logger.</param>
    public PlayerContext(DbContext context, IContextAwareRepositoryProvider repositoryProvider, ILogger<PlayerContext> logger)
        : base(context, repositoryProvider, null, logger)
    {
    }

    /// <inheritdoc/>
    public async ValueTask<DataModel.Entities.LetterBody?> GetLetterBodyByHeaderIdAsync(Guid headerId, CancellationToken cancellationToken = default)
    {
        using var context = this.RepositoryProvider.ContextStack.UseContext(this);
        if (this.RepositoryProvider.GetRepository<LetterBody, LetterBodyRepository>() is { } repository)
        {
            return await repository.GetBodyByHeaderIdAsync(headerId, cancellationToken).ConfigureAwait(false);
        }

        return null;
    }

    /// <inheritdoc/>
    public async ValueTask<bool> CanSaveLetterAsync(Interfaces.LetterHeader letterHeader, CancellationToken cancellationToken = default)
    {
        if (letterHeader is not Model.LetterHeader persistentHeader)
        {
            return false;
        }

        persistentHeader.Receiver = await this.Context.Set<Character>().FirstOrDefaultAsync(c => c.Name == letterHeader.ReceiverName, cancellationToken).ConfigureAwait(false);
        return persistentHeader.Receiver != null;
    }

    /// <inheritdoc />
    public async ValueTask<DataModel.Entities.AccountState?> AuthenticateAsync(string loginName, string password, CancellationToken cancellationToken = default)
    {
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            if (this.RepositoryProvider.GetRepository<Account, AccountRepository>() is { } accountRepository)
            {
                return await accountRepository.AuthenticateAsync(loginName, password, cancellationToken).ConfigureAwait(false);
            }
        }

        return null;
    }

    /// <inheritdoc />
    public async ValueTask<DataModel.Entities.Account?> GetAccountByLoginNameAsync(string loginName, string password, CancellationToken cancellationToken = default)
    {
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            if (this.RepositoryProvider.GetRepository<Account, AccountRepository>() is { } accountRepository)
            {
                return await accountRepository.GetAccountByLoginNameAsync(loginName, password, cancellationToken).ConfigureAwait(false);
            }
        }

        return null;
    }

    /// <inheritdoc />
    public async ValueTask<DataModel.Entities.Account?> GetAccountByLoginNameAsync(string loginName, CancellationToken cancellationToken = default)
    {
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            if (this.RepositoryProvider.GetRepository<Account, AccountRepository>() is { } accountRepository)
            {
                return await accountRepository.GetAccountByLoginNameAsync(loginName, cancellationToken).ConfigureAwait(false);
            }
        }

        return null;
    }

    /// <inheritdoc />
    public async ValueTask<IEnumerable<DataModel.Entities.Account>> GetAccountsOrderedByLoginNameAsync(int skip, int count, CancellationToken cancellationToken = default)
    {
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            return await this.Context.Set<Account>().AsNoTracking().OrderBy(a => a.LoginName).Skip(skip).Take(count).ToListAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <inheritdoc />
    public async ValueTask<IEnumerable<DataModel.Entities.Account>> SearchAccountsAsync(string searchTerm, int skip, int count, CancellationToken cancellationToken = default)
    {
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            // Invariant: this one runs in .NET, so it must not depend on the server's locale - in a
            // Turkish one, "I".ToLower() is a dotless "ı" and the term would match nothing. The
            // ToLower() calls inside the query below are a different matter: they are translated to
            // the database's own lower(), which is why they cannot take a culture.
            var term = searchTerm.ToLowerInvariant();
            return await this.Context.Set<Account>().AsNoTracking()
                .Where(a => a.LoginName.ToLower().Contains(term)
                            || a.RawCharacters.Any(c => c.Name.ToLower().Contains(term)))
                .OrderBy(a => a.LoginName)
                .Skip(skip)
                .Take(count)
                .ToListAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <inheritdoc />
    public async ValueTask<DataModel.Entities.Account?> GetAccountByCharacterNameAsync(string characterName, CancellationToken cancellationToken = default)
    {
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            if (this.RepositoryProvider.GetRepository<Account, AccountRepository>() is { } accountRepository)
            {
                return await accountRepository.GetAccountByCharacterNameAsync(characterName, cancellationToken).ConfigureAwait(false);
            }
        }

        return null;
    }

    /// <inheritdoc />
    public async ValueTask<IReadOnlyList<DataModel.Entities.CastleSiegePendingReward>> GetPendingCastleSiegeRewardsAsync(
        Guid characterId,
        CancellationToken cancellationToken = default)
    {
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            return await this.Context.Set<CastleSiegePendingReward>()
                .Where(reward => reward.CharacterId == characterId)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
        }
    }

    /// <inheritdoc />
    public async ValueTask<DataModel.Entities.ItemStorage?> GetOrCreateExtraVaultAsync(Guid accountId, int number, CancellationToken cancellationToken = default)
    {
        var id = ExtraVaultId(accountId, number);
        using (this.RepositoryProvider.ContextStack.UseContext(this))
        {
            if (this.Context.ChangeTracker.Entries<ItemStorage>().FirstOrDefault(e => e.Entity.Id == id)?.Entity is { } tracked)
            {
                return tracked;
            }

            // Loaded the way the account and its vault are (AccountRepository.GetByIdAsync).
            (this.RepositoryProvider as ICacheAwareRepositoryProvider)?.EnsureCachesForCurrentGameConfiguration();
            await this.Context.Database.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                var storage = await new Json.AccountJsonObjectLoader().LoadObjectAsync<ItemStorage>(id, this.Context, cancellationToken).ConfigureAwait(false);
                if (storage is not null)
                {
                    if (this.Context.Entry(storage).State == EntityState.Detached)
                    {
                        this.Context.Attach(storage);
                    }

                    return storage;
                }
            }
            finally
            {
                await this.Context.Database.CloseConnectionAsync().ConfigureAwait(false);
            }

            var created = new ItemStorage { Id = id };
            this.Context.Add(created);
            return created;
        }
    }

    /// <summary>
    /// The id of an account's extra vault: an MD5 of the account id and the number, with the bits of
    /// a name-based (version 3) uuid, so it never collides with the random ones OpenMU makes.
    /// </summary>
    private static Guid ExtraVaultId(Guid accountId, int number)
    {
        var name = System.Text.Encoding.UTF8.GetBytes($"mlr-vault:{accountId:N}:{number}");
        var hash = System.Security.Cryptography.MD5.HashData(name);
        hash[6] = (byte)((hash[6] & 0x0F) | 0x30);
        hash[8] = (byte)((hash[8] & 0x3F) | 0x80);
        return new Guid(hash);
    }
}
