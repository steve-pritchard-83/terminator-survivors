export const LORE = {
  prologue: `The machines rose from the ashes of the nuclear fire. Their war to exterminate mankind had raged for decades, but the final battle would not be fought in the future. It would be fought here, in our present. Tonight...`,
  location: `LOS ANGELES, 2029 A.D. // SECTOR 44 RUINS`,
  quotes: [
    `"Listen, and understand! That Terminator is out there! It can't be bargained with. It can't be reasoned with. It doesn't feel pity, or remorse, or fear. And it absolutely will not stop, ever, until you are dead!"`,
    `"The 600 series had rubber skin. We spotted them easy, but these are new. They look human... sweat, bad breath, everything."`,
    `"Phased plasma rifle in the 40-watt range."`,
    `"There is no fate but what we make for ourselves."`,
    `"Come with me if you want to live."`,
    `"Skynet defense grid smashed... we've won. Taking the time equipment now."`
  ],
  assembly6502: [
    `03A0: A9 01 8D 20 D0 // SYS OP 4102 // SCANNING TARGET`,
    `03B0: 20 12 E0 C9 44 // MATCH: DN38416 REESE, KYLE`,
    `03C0: F0 08 A2 00 BD // THREAT ASSESSMENT: EXTREME`,
    `03D0: 8D 00 04 E8 E0 // TARGET LOCK CONFIRMED // FIRE AT WILL`,
    `03E0: 4C 00 03 60 EA // CYBERDYNE SYSTEMS SERIES 800 MODEL 101`,
    `03F0: AD 12 D0 29 0F // VOLUMETRIC SEARCHLIGHT ENGAGED`,
    `0400: 8D 20 D0 60 00 // TDE COMPLEX PERIMETER BREACHED`
  ],
  victoryText: `SKYNET DEFENSE GRID COLLAPSED. TIME DISPLACEMENT EQUIPMENT SECURED.\n\nSergeant Kyle Reese steps into the glowing blue displacement sphere. Destination: Los Angeles, May 12, 1984.\n\nMISSION ACCOMPLISHED.`,
  defeatText: `TERMINATED.\n\nAnother fallen soldier of the human resistance. But as long as one human draws breath, the war is never truly over.`
} as const;
