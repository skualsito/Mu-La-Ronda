// -----------------------------------------------------------------------
// <copyright file="AntidoteConsumeHandlerPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>
// -----------------------------------------------------------------------

namespace MUnique.OpenMU.GameLogic.PlayerActions.ItemConsumeActions;

using System.Runtime.InteropServices;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Consume handler for the antidote potion. It removes the poison effect from the player.
/// </summary>
[Guid("F838B348-DAA5-475B-BCED-41A076D08948")]
[PlugIn]
[Display(Name = nameof(PlugInResources.AntidoteConsumeHandlerPlugIn_Name), Description = nameof(PlugInResources.AntidoteConsumeHandlerPlugIn_Description), ResourceType = typeof(PlugInResources))]
public class AntidoteConsumeHandlerPlugIn : BaseConsumeHandlerPlugIn
{
    /// <summary>
    /// Mu La Ronda: the antidote cures poison and the two ice effects (Iced 0x38, Freeze 0x39),
    /// as in MU - it used to leave a Silver Vepar's ice on.
    /// </summary>
    private static readonly short[] CuredEffectNumbers = [0x37, 0x38, 0x39];

    /// <inheritdoc />
    public override ItemIdentifier Key => ItemConstants.Antidote;

    /// <inheritdoc />
    public override async ValueTask<bool> ConsumeItemAsync(Player player, Item item, Item? targetItem, FruitUsage fruitUsage)
    {
        if (await base.ConsumeItemAsync(player, item, targetItem, fruitUsage).ConfigureAwait(false))
        {
            foreach (var number in CuredEffectNumbers)
            {
                if (player.MagicEffectList.ActiveEffects.TryGetValue(number, out var effect))
                {
                    effect.Dispose();
                }
            }

            return true;
        }

        return false;
    }
}