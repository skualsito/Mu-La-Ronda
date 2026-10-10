// <copyright file="MlrStatsChatCommandPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns.ChatCommands;

using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using MUnique.OpenMU.AttributeSystem;
using MUnique.OpenMU.GameLogic.Attributes;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: /estadisticas answers the character window's statistics (src/common/characterTotals.ts):
/// the totals of what the character has from everything at once - stats, items, sets, sockets,
/// buffs, VIP - as the game counts them. A few blue lines "Estadisticas: key=value;..." the client
/// reads instead of showing, ended by "Estadisticas: fin".
/// </summary>
[Guid("3C9E5B71-2A84-4D6F-B1E0-7F2A9C4D8E61")]
[PlugIn]
[Display(Name = "/estadisticas", Description = "Sends the character's statistics to the client's window.")]
[ChatCommandHelp(Command, "Sends the character's statistics (the character window shows them).", null)]
public class MlrStatsChatCommandPlugIn : IChatCommandPlugIn
{
    private const string Command = "/estadisticas";

    /// <summary>The prefix the client reads.</summary>
    private const string Prefix = "Estadisticas: ";

    /// <summary>How long one line gets, so it fits a message packet.</summary>
    private const int MaxLineLength = 180;

    private static readonly (string Key, AttributeDefinition Stat)[] Totals =
    [
        ("pmin", Stats.MinimumPhysBaseDmg),
        ("pmax", Stats.MaximumPhysBaseDmg),
        ("wmin", Stats.MinimumWizBaseDmg),
        ("wmax", Stats.MaximumWizBaseDmg),
        ("cmin", Stats.MinimumCurseBaseDmg),
        ("cmax", Stats.MaximumCurseBaseDmg),
        ("skm", Stats.SkillMultiplier),
        ("aspd", Stats.AttackSpeed),
        ("mspd", Stats.MagicSpeed),
        ("arpvm", Stats.AttackRatePvm),
        ("arpvp", Stats.AttackRatePvp),
        ("crit", Stats.CriticalDamageChance),
        ("exc", Stats.ExcellentDamageChance),
        ("dbl", Stats.DoubleDamageChance),
        ("ign", Stats.DefenseIgnoreChance),
        ("critb", Stats.CriticalDamageBonus),
        ("excb", Stats.ExcellentDamageBonus),
        ("fdmg", Stats.FinalDamageBonus),
        ("pvpdmg", Stats.FinalDamageIncreasePvp),
        ("def", Stats.DefensePvm),
        ("defpvp", Stats.DefensePvp),
        ("drpvm", Stats.DefenseRatePvm),
        ("drpvp", Stats.DefenseRatePvp),
        ("refl", Stats.DamageReflection),
        ("ddec", Stats.ArmorDamageDecrease),
        ("recv", Stats.DamageReceiveDecrement),
        ("hp", Stats.MaximumHealth),
        ("mp", Stats.MaximumMana),
        ("sd", Stats.MaximumShield),
        ("ag", Stats.MaximumAbility),
        ("hprec", Stats.HealthRecoveryMultiplier),
        ("hpkill", Stats.HealthAfterMonsterKillMultiplier),
        ("mpkill", Stats.ManaAfterMonsterKillMultiplier),
        ("zen", Stats.MoneyAmountRate),
        ("exp", Stats.BonusExperienceRate),
        ("rice", Stats.IceResistance),
        ("rfire", Stats.FireResistance),
        ("rwater", Stats.WaterResistance),
        ("rearth", Stats.EarthResistance),
        ("rwind", Stats.WindResistance),
        ("rpoison", Stats.PoisonResistance),
        ("rlight", Stats.LightningResistance),
    ];

    /// <inheritdoc />
    public string Key => Command;

    /// <inheritdoc />
    public CharacterStatus MinCharacterStatusRequirement => CharacterStatus.Normal;

    /// <inheritdoc />
    public async ValueTask HandleCommandAsync(Player player, string command)
    {
        if (player.Attributes is not { } attributes)
        {
            return;
        }

        var line = new StringBuilder(Prefix);
        foreach (var (key, stat) in Totals)
        {
            var entry = string.Create(CultureInfo.InvariantCulture, $"{key}={Math.Round(attributes[stat], 4)};");
            if (line.Length + entry.Length > MaxLineLength)
            {
                await player.ShowBlueMessageAsync(line.ToString()).ConfigureAwait(false);
                line.Clear().Append(Prefix);
            }

            line.Append(entry);
        }

        await player.ShowBlueMessageAsync(line.ToString()).ConfigureAwait(false);
        await player.ShowBlueMessageAsync(Prefix + "fin").ConfigureAwait(false);
    }
}
