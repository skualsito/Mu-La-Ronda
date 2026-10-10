// <copyright file="MlrDropRatesPlugIn.cs" company="MUnique">
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// </copyright>

namespace MUnique.OpenMU.GameLogic.PlugIns;

using System.Runtime.InteropServices;
using MUnique.OpenMU.PlugIns;

/// <summary>
/// Mu La Ronda: the server's drop rates, set from the own admin panel (Configuración > Juego).
/// They scale the chance of every drop group that is drawn (not the guaranteed ones, nor the
/// bosses' tables) and the zen a monster drops: 100 is the configuration as it is.
/// </summary>
[PlugIn]
[Display(Name = "Mu La Ronda drop rates", Description = "Multiplies the item, excellent item and zen drops.")]
[Guid("C3F1A2B4-5D6E-4F70-8192-A3B4C5D6E7F8")]
public class MlrDropRatesPlugIn : IFeaturePlugIn, ISupportCustomConfiguration<MlrDropRatesConfiguration>, ISupportDefaultCustomConfiguration
{
    /// <inheritdoc/>
    public MlrDropRatesConfiguration? Configuration { get; set; }

    /// <inheritdoc />
    public object CreateDefaultConfig() => new MlrDropRatesConfiguration();
}

/// <summary>
/// The drop rates of <see cref="MlrDropRatesPlugIn"/>, in percent.
/// </summary>
public class MlrDropRatesConfiguration
{
    /// <summary>Gets or sets the rate of the common item drops, in percent.</summary>
    public int ItemDropRate { get; set; } = 100;

    /// <summary>Gets or sets the rate of the excellent and ancient item drops, in percent.</summary>
    public int ExcellentDropRate { get; set; } = 100;

    /// <summary>Gets or sets the rate of the zen a monster drops, in percent of the amount.</summary>
    public int ZenDropRate { get; set; } = 100;
}
