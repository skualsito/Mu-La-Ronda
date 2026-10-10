// <copyright file="VipDiscountCodes.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.VipSystem;

using System.Data;
using System.Data.Common;

/// <summary>
/// Mu La Ronda: the VIP discount codes. They are made, edited and deleted in the own admin panel
/// (admin/server/vipCodes.ts) and kept in the table mlr.vip_codes of the game database
/// (deploy/config/10-vip.sql), so a new code works at once, without restarting the server.
/// OpenMU's persistence has no way to read a table of ours, so this opens its own connection
/// with the same settings the server gets (DB_HOST, DB_ADMIN_USER, DB_ADMIN_PW), through the
/// Npgsql driver the server already loads - by name, as GameLogic doesn't reference it.
/// </summary>
public static class VipDiscountCodes
{
    /// <summary>A code that may be used: its discount in percent.</summary>
    /// <param name="Code">The code as it is stored.</param>
    /// <param name="Percent">The discount, 1-100.</param>
    public record Discount(string Code, int Percent);

    /// <summary>
    /// Looks the code up for this account: null when it doesn't exist, is off, ran out, expired,
    /// or this account already used it (for codes that allow one use per account).
    /// </summary>
    /// <param name="code">The code the player typed.</param>
    /// <param name="accountId">The account.</param>
    /// <returns>The discount, or null with the reason.</returns>
    public static async ValueTask<(Discount? Discount, string? Refusal)> FindAsync(string code, Guid accountId)
    {
        await using var connection = await OpenAsync().ConfigureAwait(false);
        if (connection is null)
        {
            return (null, "los codigos no estan disponibles ahora.");
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT c.code, c.percent,
                   c.active,
                   (c.expires_at IS NOT NULL AND c.expires_at <= now()) AS expired,
                   (c.max_uses IS NOT NULL AND c.uses >= c.max_uses) AS spent,
                   (c.once_per_account AND EXISTS (SELECT 1 FROM mlr.vip_code_uses u
                                                    WHERE u.code_id = c.id AND u.account_id = @account)) AS used
              FROM mlr.vip_codes c
             WHERE lower(c.code) = lower(@code)
            """;
        AddParameter(command, "code", code.Trim());
        AddParameter(command, "account", accountId);
        await using var reader = await command.ExecuteReaderAsync().ConfigureAwait(false);
        if (!await reader.ReadAsync().ConfigureAwait(false))
        {
            return (null, "ese codigo no existe.");
        }

        var discount = new Discount(reader.GetString(0), reader.GetInt32(1));
        if (!reader.GetBoolean(2))
        {
            return (null, "ese codigo esta desactivado.");
        }

        if (reader.GetBoolean(3))
        {
            return (null, "ese codigo ya vencio.");
        }

        if (reader.GetBoolean(4))
        {
            return (null, "ese codigo ya se uso todas las veces que se podia.");
        }

        if (reader.GetBoolean(5))
        {
            return (null, "ya usaste ese codigo.");
        }

        return (discount, null);
    }

    /// <summary>
    /// Counts one use, if the code may still be used (another purchase may have just taken the last
    /// one). False when it may not, then nothing was counted.
    /// </summary>
    /// <param name="discount">The code.</param>
    /// <param name="accountId">The account.</param>
    /// <param name="price">The price paid.</param>
    /// <returns>Whether the use was counted.</returns>
    public static async ValueTask<bool> RedeemAsync(Discount discount, Guid accountId, long price)
    {
        await using var connection = await OpenAsync().ConfigureAwait(false);
        if (connection is null)
        {
            return false;
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            WITH taken AS (
              UPDATE mlr.vip_codes c SET uses = uses + 1
               WHERE lower(c.code) = lower(@code) AND c.active
                 AND (c.expires_at IS NULL OR c.expires_at > now())
                 AND (c.max_uses IS NULL OR c.uses < c.max_uses)
                 AND NOT (c.once_per_account AND EXISTS (SELECT 1 FROM mlr.vip_code_uses u
                                                          WHERE u.code_id = c.id AND u.account_id = @account))
              RETURNING c.id)
            INSERT INTO mlr.vip_code_uses (code_id, account_id, price, used_at)
            SELECT id, @account, @price, now() FROM taken
            """;
        AddParameter(command, "code", discount.Code);
        AddParameter(command, "account", accountId);
        AddParameter(command, "price", price);
        return await command.ExecuteNonQueryAsync().ConfigureAwait(false) > 0;
    }

    internal static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    internal static async ValueTask<DbConnection?> OpenAsync()
    {
        var type = Type.GetType("Npgsql.NpgsqlConnection, Npgsql");
        var host = Environment.GetEnvironmentVariable("DB_HOST");
        if (type is null || string.IsNullOrWhiteSpace(host))
        {
            return null;
        }

        var user = Environment.GetEnvironmentVariable("DB_ADMIN_USER") ?? "postgres";
        var password = Environment.GetEnvironmentVariable("DB_ADMIN_PW") ?? string.Empty;
        var database = Environment.GetEnvironmentVariable("DB_NAME") ?? "openmu";
        var connectionString = $"Host={host};Username={user};Password={password};Database={database};Timeout=5;Pooling=true";
        if (Activator.CreateInstance(type, connectionString) is not DbConnection connection)
        {
            return null;
        }

        await connection.OpenAsync().ConfigureAwait(false);
        return connection.State == ConnectionState.Open ? connection : null;
    }
}
