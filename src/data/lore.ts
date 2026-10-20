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

export const WEAPON_CODEX: Record<
  string,
  { name: string; designation: string; lore: string; manufacturer: string }
> = {
  ithaca_37: {
    name: 'Ithaca 37 12-Gauge',
    designation: 'Model 37 Pump-Action Shotgun',
    lore: 'Kyle Reese\'s signature civilian pump-action shotgun, modified with a sawed-off stock and custom shoulder strap lanyard. Delivers devastating kinetic knockback at close quarters.',
    manufacturer: 'Ithaca Gun Company'
  },
  pipe_bomb: {
    name: 'Thermite Pipe Bomb',
    designation: 'Tech-Com Improvised Explosive Device',
    lore: 'Hand-packed galvanized steel plumbing pipes filled with powdered rust, aluminum fuel, and magnesium igniter ribbons. Lobbed over machine barricades to blow out drive tracks.',
    manufacturer: 'Tech-Com Demolitions Squad'
  },
  m25_plasma: {
    name: 'Westinghouse M-25 Phased Plasma',
    designation: 'Westinghouse General 40-Watt Plasma Rifle',
    lore: 'The standard-issue infantry weapon of the United States Technical Division in 2029. Employs magnetic plasma acceleration coils spitting superheated ionized gas pulses.',
    manufacturer: 'Westinghouse / Tech-Com Salvage'
  },
  seeker_drone: {
    name: 'Autonomous Seeker Drone',
    designation: 'Reprogrammed Micro-UAV Interceptor',
    lore: 'Scavenged Skynet sensor drones re-flashed with open-source Tech-Com autonomous targeting kernels. Orbits the operative before homing in on the nearest machine chassis.',
    manufacturer: 'Tech-Com Cybernetics Unit'
  },
  emp_emitter: {
    name: 'EMP Burst Emitter',
    designation: 'Tachyon Electromagnetic Pulse Node',
    lore: 'Radial capacitor discharger that generates localized electromagnetic pulses, overloading machine neural net buses and stripping hyperalloy armor coatings.',
    manufacturer: 'Tech-Com Tactical Science Division'
  },
  m79_thumper: {
    name: 'M79 "Thumper" Grenade Launcher',
    designation: '40mm Break-Action Ordnance Launcher',
    lore: 'Single-shot break-open launcher firing 40x46mm high-explosive grenades. Its characteristic hollow "thump" upon discharge is a welcome sound to cornered human resistance fighters.',
    manufacturer: 'Springfield Armory'
  },
  napalm_canister: {
    name: 'Aerosolized Napalm Canister',
    designation: 'Incendiary Area Denial Projectile',
    lore: 'Pressurized canisters of viscous chemical incendiary fuel that coat the ground in persistent flames, incinerating low-altitude drones and melting machine rubber flesh coverings.',
    manufacturer: 'Tech-Com Chemical Works'
  },
  laser_designator: {
    name: 'Tactical Laser Designator',
    designation: 'Orbital & Heavy Mortar Uplink Node',
    lore: 'Handheld pulsed infrared collimator linked to scavenged automated defense satellite arrays and bunker mortar emplacements to rain pin-point kinetic strikes.',
    manufacturer: 'Tech-Com Signal Corps'
  },
  m16_carbine: {
    name: 'Colt M16A1 Assault Rifle',
    designation: '5.56x45mm NATO Select-Fire Rifle',
    lore: 'A pre-war classic that saw continuous service into the late 2020s. Lightweight, high cyclic rate of fire, and deadly when loaded with hand-crafted tungsten-core penetrators.',
    manufacturer: 'Colt Defense'
  },
  rpg_launcher: {
    name: 'RPG-7 Rocket Launcher',
    designation: 'Shoulder-Launched Anti-Armor Rocket',
    lore: 'Rugged unguided anti-tank weapon firing PG-7V shaped-charge rocket projectiles capable of piercing hyperalloy armor skirts on Hunter-Killer combat tanks.',
    manufacturer: 'Bazalt / Resistance Armories'
  },
  molotov: {
    name: 'Improvised Fuel Molotov',
    designation: 'Glass Bottle Incendiary Contrivance',
    lore: 'Motor oil and gasoline enclosed in glass beverage bottles with cloth rag wicks. The classic urban guerrilla response to machine ground sweeps.',
    manufacturer: 'Civilian Resistance Brigades'
  },
  resistance_k9: {
    name: 'Tech-Com Patrol K-9 Unit',
    designation: 'Biological Cybernetic Detection Canine',
    lore: 'German Shepherds and Belgian Malinois bred and trained by the resistance to sniff out synthetic organic skin sheaths on Series 800 and 600 infiltrator units.',
    manufacturer: 'Tech-Com Canine Division'
  },
  reprogrammed_t800: {
    name: 'Reprogrammed T-800 Companion',
    designation: 'Re-written Neural Net Combat Drone',
    lore: 'A captured Series 800 Terminator whose CPU switch was extracted and reset from "read-only" to "write". Re-tasked with a single mission directive: protect the resistance.',
    manufacturer: 'Cyberdyne Systems / Tech-Com'
  },
  coltan_knife: {
    name: 'Coltan Alloy Combat Blade',
    designation: 'High-Density Vibrational Dagger',
    lore: 'Forged from scrap coltan mined from destroyed Terminator chassis. Capable of slicing through heavy hydraulic cables and sensory wiring harnesses.',
    manufacturer: 'Tech-Com Blacksmith Enclave'
  },
  trench_sweeper: {
    name: 'Trench Sweeper Autocannon',
    designation: 'Evolved Model 37 Full-Auto Sweeper',
    lore: 'Drum-fed fully-automatic shotgun conversion unleashing continuous 360-degree buckshot clouds that shred advancing endoskeletons into scrap.',
    manufacturer: 'Tech-Com Demolitions & Ordnance'
  },
  thermite_buster: {
    name: 'Thermite Buster Shockwave',
    designation: 'Evolved Heavy Cluster Bomb',
    lore: 'Submunition-packing thermite charges that detonate into secondary shockwave fissures, melting through ground concrete and underlying bunkers.',
    manufacturer: 'Tech-Com Demolitions & Ordnance'
  },
  m95a1_plasma: {
    name: 'M95A1 Heavy Phased Plasma',
    designation: 'Evolved Twin-Chamber Plasma Gatling',
    lore: 'Supercooled plasma weapon utilizing superconducting phase inductors to fire piercing hyper-velocity plasma lances with zero chamber cooldown.',
    manufacturer: 'Westinghouse Advanced Technology'
  },
  perimeter_ring: {
    name: 'Perimeter Defense Ring',
    designation: 'Evolved Autonomous Kinetic Orbital Barrier',
    lore: 'A coordinated orbital fleet of micro-interceptor drones providing a continuous rotating ring of physical kinetic deflection and laser interception.',
    manufacturer: 'Tech-Com Cybernetics Unit'
  },
  emp_supernova: {
    name: 'Tachyon EMP Supernova',
    designation: 'Evolved Resonance Discharge Core',
    lore: 'Overcharges the central flux coil into a screen-clearing electromagnetic shockwave that permanently strips armor plating from all surrounding machines.',
    manufacturer: 'Tech-Com Tactical Science Division'
  },
  mm1_barrage: {
    name: 'MM-1 Rotary Barrage',
    designation: 'Evolved 12-Shot Rotary Grenade Platform',
    lore: '12-round rotary grenade launcher system that floods the combat sector in perpetual explosive detonations, leaving no machine standing.',
    manufacturer: 'Springfield / Tech-Com Armory'
  },
  firestorm_wall: {
    name: 'Firestorm Wall Projector',
    designation: 'Evolved Pressurized Chemical Barrier',
    lore: 'Continuous pressurized aerosol flame streams forming an impenetrable wall of burning chemical inferno that consumes incoming swarms.',
    manufacturer: 'Tech-Com Chemical Works'
  },
  orbital_ion: {
    name: 'Orbital Ion Cannon Strike',
    designation: 'Evolved Defense Satellite Beam Uplink',
    lore: 'Commands orbital kinetic ion satellites to focus multi-gigawatt particle beams directly onto heavy machine priority targets.',
    manufacturer: 'US Space Command / Tech-Com'
  },
  phased_plasma_assault: {
    name: 'Phased Plasma Carbine',
    designation: 'Evolved Plasma-Enriched Assault Rifle',
    lore: 'Converts standard 5.56mm kinetic ammunition into accelerated plasma-coated micro-rounds, combining ballistic penetration with thermal vaporization.',
    manufacturer: 'Tech-Com Field R&D'
  },
  tandem_warhead: {
    name: 'Tandem Hyperalloy Warhead',
    designation: 'Evolved Multi-Stage Rocket Ordnance',
    lore: 'Features a precursor shaped-charge warhead to compromise surface reactive armor followed by a secondary hyperalloy penetrator.',
    manufacturer: 'Resistance Heavy Weapons Depot'
  },
  firestorm_lane: {
    name: 'Firestorm Street Sweeper',
    designation: 'Evolved High-Volatility Incendiary Line',
    lore: 'Infused with high-octane volatile accelerants that splash across asphalt in lethal fiery lines, inflicting critical burns on machine treads.',
    manufacturer: 'Civilian Resistance Brigades'
  },
  k9_pack: {
    name: 'Alpha K-9 Combat Pack',
    designation: 'Evolved Multi-Canine Patrol Strike Group',
    lore: 'An coordinated pack of ferocious resistance war hounds trained to bite through hydraulic limbs and pin down machine scouts.',
    manufacturer: 'Tech-Com Canine Division'
  },
  guardian_protocol: {
    name: 'T-800 Guardian Protocol',
    designation: 'Evolved Heavy Endoskeleton Aegis',
    lore: 'The reprogrammed T-800 activates protective shielding and advanced tactical targeting subroutines, standing as an indestructible shield for Kyle Reese.',
    manufacturer: 'Tech-Com Cybernetics Unit'
  },
  hyperalloy_blade: {
    name: 'Hyperalloy Executioner Blade',
    designation: 'Evolved Anti-Chassis Greatsword',
    lore: 'A massive two-handed sword forged from crushed T-800 skull plates that cleaves through machine limbs and armor joints in wide sweeping arcs.',
    manufacturer: 'Tech-Com Blacksmith Enclave'
  }
};



