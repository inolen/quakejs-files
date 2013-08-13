var FLAGS = {
	NODAMAGE:    0x1,                                      // never give falling damage
	SLICK:       0x2,                                      // effects game physics
	SKY:         0x4,                                      // lighting from environment map
	LADDER:      0x8,
	NOIMPACT:    0x10,                                     // don't make missile explosions
	NOMARKS:     0x20,                                     // don't leave missile marks
	FLESH:       0x40,                                     // make flesh sounds and effects
	NODRAW:      0x80,                                     // don't generate a drawsurface at all
	HINT:        0x100,                                    // make a primary bsp splitter
	SKIP:        0x200,                                    // completely ignore, allowing non-closed brushes
	NOLIGHTMAP:  0x400,                                    // surface doesn't need a lightmap
	POINTLIGHT:  0x800,                                    // generate lighting info at vertexes
	METALSTEPS:  0x1000,                                   // clanking footsteps
	NOSTEPS:     0x2000,                                   // no footstep sounds
	NONSOLID:    0x4000,                                   // don't collide against curves with this set
	LIGHTFILTER: 0x8000,                                   // act as a light filter during q3map -light
	ALPHASHADOW: 0x10000,                                  // do per-pixel light shadow casting in q3map
	NODLIGHT:    0x20000,                                  // don't dlight even if solid (solid lava, skies)
	DUST:        0x40000                                   // leave a dust trail when walking on this surface
};

var CONTENTS = {
	SOLID:         1,                                      // an eye is never valid in a solid
	LAVA:          8,
	SLIME:         16,
	WATER:         32,
	FOG:           64,

	NOTTEAM1:      0x0080,
	NOTTEAM2:      0x0100,
	NOBOTCLIP:     0x0200,

	AREAPORTAL:    0x8000,

	PLAYERCLIP:    0x10000,
	MONSTERCLIP:   0x20000,
	TELEPORTER:    0x40000,
	JUMPPAD:       0x80000,
	CLUSTERPORTAL: 0x100000,
	DONOTENTER:    0x200000,
	BOTCLIP:       0x400000,
	MOVER:         0x800000,

	ORIGIN:        0x1000000,                              // removed before bsping an entity

	BODY:          0x2000000,                              // should never be on a brush, only in game
	CORPSE:        0x4000000,
	DETAIL:        0x8000000,                              // brushes not used for the bsp
	STRUCTURAL:    0x10000000,                             // brushes used for the bsp
	TRANSLUCENT:   0x20000000,                             // don't consume surface fragments inside
	TRIGGER:       0x40000000,
	NODROP:        0x80000000                              // don't leave bodies or items (death fog, lava)
};

module.exports = {
	FLAGS:    FLAGS,
	CONTENTS: CONTENTS
};