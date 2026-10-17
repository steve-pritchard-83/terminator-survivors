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

export const ENEMY_CODEX: Record<
  import('../core/types').EnemyArchetypeId,
  { name: string; designation: string; codex: string; threat: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | 'LETHAL' }
> = {
  skynet_crab_drone: {
    name: 'Skynet Recon Scuttler',
    designation: 'M-12 Autonomous Recon Quadruped',
    codex: 'Mass-produced scouting scuttlers designed to clear rubble and crawl into human refuge tunnels. Light titanium carapace, fast skittering stride.',
    threat: 'LOW'
  },
  t600_rusted: {
    name: 'Series 600 Heavy Walker',
    designation: 'Cyberdyne Systems Series 600',
    codex: 'Early battlefield infiltrators clad in crude synthetic rubber skins. Easily distinguished by their rigid lumbering gait and pungent smell. Heavy titanium core.',
    threat: 'MEDIUM'
  },
  t700_scout: {
    name: 'Series 700 Runner',
    designation: 'Cyberdyne Systems Series 700 Endoskeleton',
    codex: 'Bridge design between Series 600 and 800. Sleeker hydraulic musculature and reinforced leg servos designed for high-speed pursuit.',
    threat: 'MEDIUM'
  },
  t800_endoskeleton: {
    name: 'Series 800 Hyperalloy Endoskeleton',
    designation: 'Cyberdyne Systems Series 800 Model 101',
    codex: 'Microprocessor-controlled hyperalloy combat chassis. Frictionless pneumatic joints, armored cerebral cortex housing the neural net processor. The ultimate infantry termination platform.',
    threat: 'HIGH'
  },
  hk_aerial_patrol: {
    name: 'Hunter-Killer Aerial Gunship',
    designation: 'Skynet VTOL Gunship Patrol Unit',
    codex: 'Twin turbofan VTOL patrol craft armed with dual ventral plasma cannons and downward-facing searchlight tracking arrays.',
    threat: 'HIGH'
  },
  infiltrator_csm101: {
    name: 'Infiltrator Unit CSM-101',
    designation: 'Cyberdyne Systems Model 101 Infiltration Unit',
    codex: 'Living human tissue grown over hyperalloy endoskeleton. Capable of mimicking human speech, sweat, and breath. Relentless hunter designed to infiltrate underground resistance sanctuaries.',
    threat: 'EXTREME'
  },
  hk_tank_goliath: {
    name: 'Hunter-Killer Tank Goliath',
    designation: 'Skynet Ground Assault Dreadnought',
    codex: 'Massive tracked siege war machine towering over the ruins of Los Angeles. Crushes concrete and human skulls alike under triple-tread bogies while firing twin heavy plasma artillery mortars.',
    threat: 'EXTREME'
  },
  hk_aerial_squadron_leader: {
    name: 'HK-Aerial Command Gunship',
    designation: 'Skynet Aerial Command & Control Flagship',
    codex: 'Heavily armored flagship VTOL coordinating regional search-and-destroy sorties. Equipped with multi-vector missile salvo pods and reinforced nose armor for diving kamikaze strikes.',
    threat: 'EXTREME'
  },
  t1000_prototype: {
    name: 'Liquid Metal Prototype T-1000',
    designation: 'Advanced Prototype Mimetic Polyalloy',
    codex: 'Autonomous liquid metal polyalloy prototype capable of molecular morphing into solid knives and stabbing blades. Impervious to kinetic trauma and able to reform from molten puddles.',
    threat: 'LETHAL'
  },
  skynet_tde_core: {
    name: 'Skynet Time Displacement Core',
    designation: 'Central Quantum Displacement Facility',
    codex: 'The heart of Skynet\'s temporal installation beneath Cheyenne Mountain and LA Central. Creates gravitational singularities and rotating plasma spokes while generating the displacement sphere.',
    threat: 'LETHAL'
  },
  t1_minigun_tracked: {
    name: 'T-1 Heavy Battlefield Chassis',
    designation: 'Cyber Research Systems T-1 Autonomous Ground Unit',
    codex: 'First-generation combat robot originally developed before Judgment Day. Dual tank treads carry twin high-cyclic rate miniguns capable of laying down devastating sweeping bullet cones.',
    threat: 'MEDIUM'
  },
  moto_terminator: {
    name: 'Moto-Terminator Flanker',
    designation: 'Autonomous High-Speed Interceptor Cycle',
    codex: 'Skynet reconnaissance cycles designed for high-speed road and desert pursuit. Uses gyroscopic stabilizers to execute lightning-fast straight-line dashes through resistance flanking lines.',
    threat: 'HIGH'
  },
  hydrobot_swarm: {
    name: 'Skynet Hydrobot Serpent',
    designation: 'Aquatic and Subterranean Autonomous Hunter',
    codex: 'Segmented serpentine terminators operating in swarms of 12. Highly agile swimmers and burrowers that leap out of storm drains and drainage ditches with razor-sharp hydraulic clamp jaws.',
    threat: 'LOW'
  },
  aerostat_scout: {
    name: 'Skynet Aerostat Aerial Scout',
    designation: 'Micro-UAV Sensor Drone',
    codex: 'Compact hovering scout craft equipped with infrared sensors and laser telemetry markers. When painting resistance targets, it transmits overclock telemetry boosting nearby ground units by +20% speed.',
    threat: 'MEDIUM'
  },
  plasma_turret: {
    name: 'Skynet Perimeter Defense Turret',
    designation: 'Static Reinforced Heavy Emplacement',
    codex: 'Stationary armored concrete pillbox mounting dual phased plasma cannons. Locked to regional defensive perimeters with automated motion tracking and precision line telegraph targeting.',
    threat: 'HIGH'
  },
  t600_minigunner: {
    name: 'Series 600 Minigun Enforcer',
    designation: 'Cyberdyne Series 600 Heavy Weapons Specialist',
    codex: 'A fortified variant of the Series 600 wielding a man-portable rotary machine gun fed by a rear hyperalloy ammunition drum. Designed to pin down resistance combat squads with suppressive fire.',
    threat: 'HIGH'
  }
};

