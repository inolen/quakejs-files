var SURF = require('./surfaceflags');
var Tokenizer = require('./tokenizer');

var SORT = {
	BAD:            0,
	PORTAL:         1,                                     // mirrors, portals, viewscreens
	ENVIRONMENT:    2,                                     // sky box
	OPAQUE:         3,                                     // opaque
	DECAL:          4,                                     // scorch marks, etc.
	SEE_THROUGH:    5,                                     // ladders, grates, grills that may have small blended
	                                                       // edges in addition to alpha test
	BANNER:         6,
	FOG:            7,
	UNDERWATER:     8,                                     // for items that should be drawn in front of the water plane
	BLEND0:         9,                                     // regular transparency and filters
	BLEND1:         10,                                    // generally only used for additive type effects
	BLEND2:         11,
	BLEND3:         12,
	BLEND6:         13,
	STENCIL_SHADOW: 14,
	ALMOST_NEAREST: 15,                                    // gun smoke puffs
	NEAREST:        16                                     // blood blobs
};

var surfaceParams = {
	// server relevant contents
	'water':         { surface: 0,                      contents: SURF.CONTENTS.WATER },
	'slime':         { surface: 0,                      contents: SURF.CONTENTS.SLIME },         // mildly damaging
	'lava':          { surface: 0,                      contents: SURF.CONTENTS.LAVA },          // very damaging
	'playerclip':    { surface: 0,                      contents: SURF.CONTENTS.PLAYERCLIP },
	'monsterclip':   { surface: 0,                      contents: SURF.CONTENTS.MONSTERCLIP },
	'nodrop':        { surface: 0,                      contents: SURF.CONTENTS.NODROP },        // don't drop items or leave bodies (death fog, lava, etc)
	'nonsolid':      { surface: SURF.FLAGS.NONSOLID,    contents: 0 },                      // clears the solid flag

	// utility relevant attributes
	'origin':        { surface: 0,                      contents: SURF.CONTENTS.ORIGIN },        // center of rotating brushes
	'trans':         { surface: 0,                      contents: SURF.CONTENTS.TRANSLUCENT },   // don't eat contained surfaces
	'detail':        { surface: 0,                      contents: SURF.CONTENTS.DETAIL },        // don't include in structural bsp
	'structural':    { surface: 0,                      contents: SURF.CONTENTS.STRUCTURAL },    // force into structural bsp even if trnas
	'areaportal':    { surface: 0,                      contents: SURF.CONTENTS.AREAPORTAL },    // divides areas
	'clusterportal': { surface: 0,                      contents: SURF.CONTENTS.CLUSTERPORTAL }, // for bots
	'donotenter':    { surface: 0,                      contents: SURF.CONTENTS.DONOTENTER },    // for bots

	'fog':           { surface: 0,                      contents: SURF.CONTENTS.FOG},            // carves surfaces entering
	'sky':           { surface: SURF.FLAGS.SKY,         contents: 0 },                      // emit light from an environment map
	'lightfilter':   { surface: SURF.FLAGS.LIGHTFILTER, contents: 0 },                      // filter light going through it
	'alphashadow':   { surface: SURF.FLAGS.ALPHASHADOW, contents: 0 },                      // test light on a per-pixel basis
	'hint':          { surface: SURF.FLAGS.HINT,        contents: 0 },                      // use as a primary splitter

	// server attributes
	'slick':         { surface: SURF.FLAGS.SLICK,       contents: 0 },
	'noimpact':      { surface: SURF.FLAGS.NOIMPACT,    contents: 0 },                      // don't make impact explosions or marks
	'nomarks':       { surface: SURF.FLAGS.NOMARKS,     contents: 0 },                      // don't make impact marks, but still explode
	'ladder':        { surface: SURF.FLAGS.LADDER,      contents: 0 },
	'nodamage':      { surface: SURF.FLAGS.NODAMAGE,    contents: 0 },
	'metalsteps':    { surface: SURF.FLAGS.METALSTEPS,  contents: 0 },
	'flesh':         { surface: SURF.FLAGS.FLESH,       contents: 0 },
	'nosteps':       { surface: SURF.FLAGS.NOSTEPS,     contents: 0 },

	// drawsurf attributes
	'nodraw':        { surface: SURF.FLAGS.NODRAW,      contents: 0 },                      // don't generate a drawsurface (or a lightmap)
	'pointlight':    { surface: SURF.FLAGS.POINTLIGHT,  contents: 0 },                      // sample lighting at vertexes
	'nolightmap':    { surface: SURF.FLAGS.NOLIGHTMAP,  contents: 0 },                      // don't generate a lightmap
	'nodlight':      { surface: SURF.FLAGS.NODLIGHT,    contents: 0 },                      // don't ever add dynamic lights
	'dust':          { surface: SURF.FLAGS.DUST,        contents: 0 }                       // leave a dust trail when walking on this surface
};

var Shader = function () {
	this.name           = null;
	this.sort           = 0;
	this.surfaceFlags   = 0;
	this.contentFlags   = 0;
	this.cull           = 'front';
	this.sky            = false;
	this.cloudSize      = 0;
	this.innerBox       = [];
	this.outerBox       = [];
	this.fog            = false;
	this.polygonOffset  = false;
	this.entityMergable = false;
	this.positionLerp   = false;
	this.portalRange    = 0;
	this.vertexDeforms  = [];
	this.stages         = [];
};

var ShaderStage = function () {
	this.hasBlendFunc = false;
	this.blendSrc     = 'GL_ONE';
	this.blendDest    = 'GL_ZERO';
	this.depthWrite   = true;
	this.depthFunc    = 'lequal';

	this.maps         = [];
	this.animFreq     = 0;
	this.clamp        = false;
	this.tcGen        = 'base';
	this.rgbGen       = 'identity';
	this.rgbWave      = null;
	this.alphaGen     = '1.0';
	this.alphaFunc    = null;
	this.alphaWave    = null;
	this.isLightmap   = false;
	this.tcMods       = [];
};

var Deform = function () {
	this.type   = null;
	this.spread = 0.0;
	this.wave   = null;
};

var TexMod = function () {
	this.type       = null;
	this.scaleX     = 0.0;
	this.scaleY     = 0.0;
	this.sSpeed     = 0.0;
	this.tSpeed     = 0.0;
	this.wave       = null;
	this.turbulance = null;
};

var Waveform = function () {
	this.funcName = null;
	this.base     = 0.0;
	this.amp      = 0.0;
	this.phase    = 0.0;
	this.freq     = 0.0;
};

function loadScript(text) {
	var tokens = new Tokenizer(text);
	var bodies = {};

	while (!tokens.EOF()) {
		var name = tokens.next().toLowerCase();

		var depth = 0;
		var buffer = name + ' ';
		do {
			var token = tokens.next();

			if (token === '{') {
				depth++;
			} else if (token === '}') {
				depth--;
			}

			buffer += token + ' ';
		} while (depth && !tokens.EOF());

		bodies[name] = buffer;
	}

	return bodies;
}

function loadShader(text, lightmapIndex) {
	var tokens = new Tokenizer(text);

	var script = new Shader();
	script.name = tokens.next();

	// Sanity check.
	if (tokens.next() !== '{') return null;

	while (!tokens.EOF()) {
		var token = tokens.next().toLowerCase();

		if (token == '}') break;

		switch (token) {
			case '{':
				parseStage(tokens, script, lightmapIndex);
				break;

			case 'sort':
				parseSort(tokens, script);
				break;

			case 'cull':
				script.cull = tokens.next();
				break;

			case 'deformvertexes':
				parseDeform(tokens, script);
				break;

			case 'surfaceparm':
				parseSurfaceparm(tokens, script);
				continue;

			case 'polygonoffset':
				script.polygonOffset = true;
				break;

			// entityMergable, allowing sprite surfaces from multiple entities
			// to be merged into one batch.  This is a savings for smoke
			// puffs and blood, but can't be used for anything where the
			// shader calcs (not the surface function) reference the entity color or scroll
			case 'entitymergable':
				script.entityMergable = true;
				break;

			case 'portal':
				script.sort = SORT.PORTAL;
				break;

			case 'fogparms':
				script.fog = true;
				script.sort = SORT.FOG;
				break;

			case 'skyparms':
				parseSkyparms(tokens, script);
				break;

			default: break;
		}
	}

	//
	// If the shader is using polygon offset,
	// it's a decal shader.
	//
	if (script.polygonOffset && !script.sort) {
		script.sort = SORT.DECAL;
	}

	for (var i = 0; i < script.stages.length; i++) {
		var stage = script.stages[i];

		//
		// Determine sort order and fog color adjustment
		//
		if (script.stages[0].hasBlendFunc && stage.hasBlendFunc) {
			// Don't screw with sort order if this is a portal or environment.
			if (!script.sort) {
				// See through item, like a grill or grate.
				if (stage.depthWrite) {
					script.sort = SORT.SEE_THROUGH;
				} else {
					script.sort = SORT.BLEND0;
				}
			}
		}
	}

	// There are times when you will need to manually apply a sort to
	// opaque alpha tested shaders that have later blend passes.
	if (!script.sort) {
		script.sort = SORT.OPAQUE;
	}

	return script;
}

function parseDeform(tokens, script) {
	var deform = new Deform();

	deform.type = tokens.next().toLowerCase();

	switch (deform.type) {
		case 'wave':
			deform.spread = 1.0 / parseFloat(tokens.next());
			deform.wave = parseWaveForm(tokens);
			script.vertexDeforms.push(deform);
			break;
	}
}

function parseSort(tokens, script) {
	var val = tokens.next().toLowerCase();

	switch (val) {
		case 'portal':     script.sort = SORT.PORTAL;         break;
		case 'sky':        script.sort = SORT.ENVIRONMENT;    break;
		case 'opaque':     script.sort = SORT.OPAQUE;         break;
		case 'decal':      script.sort = SORT.DECAL;          break;
		case 'seeThrough': script.sort = SORT.SEE_THROUGH;    break;
		case 'banner':     script.sort = SORT.BANNER;         break;
		case 'additive':   script.sort = SORT.BLEND1;         break;
		case 'nearest':    script.sort = SORT.NEAREST;        break;
		case 'underwater': script.sort = SORT.UNDERWATER;     break;
		default:           script.sort = parseInt(val, 10); break;
	}
}

function parseSurfaceparm(tokens, script) {
	var val = tokens.next().toLowerCase();

	var parm = surfaceParams[val];

	if (!parm) {
		return;
	}

	script.surfaceFlags |= parm.surface;
	script.contentFlags |= parm.contents;
}

function parseSkyparms(tokens, script) {
	var suffixes = ['rt', 'bk', 'lf', 'ft', 'up', 'dn'];

	var innerBox = tokens.next().toLowerCase();
	var cloudSize = parseInt(tokens.next(), 10);
	var outerBox = tokens.next().toLowerCase();

	script.sky = true;
	script.innerBox = innerBox === '-' ? [] : suffixes.map(function (suf) {
		return innerBox + '_' + suf + '.tga';
	});
	script.cloudSize = cloudSize;
	script.outerBox = outerBox === '-' ? [] : suffixes.map(function (suf) {
		return outerBox + '_' + suf + '.tga';
	});
	script.sort = SORT.ENVIRONMENT;
}

function parseStage(tokens, script, lightmapIndex) {
	var stage = new ShaderStage();

	while (!tokens.EOF()) {
		var token = tokens.next();
		if (token == '}') {
			break;
		}

		switch (token.toLowerCase()) {
			case 'clampmap':
				stage.clamp = true;
			case 'map':
				var map = tokens.next();
				if (!map) {
					throw new Exception('WARNING: missing parameter for \'map\' keyword in script \'' + script.name + '\'');
				}
				if (map === '$whiteimage') {
					map = '*white';
				} else if (map == '$lightmap') {
					stage.isLightmap = true;
					if (lightmapIndex < 0) {
						map = '*white';
					} else {
						map = '*lightmap';
					}
				}
				stage.maps.push(map);
				break;

			case 'animmap':
				stage.animFreq = parseFloat(tokens.next());
				var nextMap = tokens.next();
				while (nextMap.match(/\.[^\/.]+$/)) {
					stage.maps.push(nextMap);
					nextMap = tokens.next();
				}
				tokens.prev();
				break;

			case 'rgbgen':
				stage.rgbGen = tokens.next().toLowerCase();
				switch (stage.rgbGen) {
					case 'wave':
						stage.rgbWave = parseWaveForm(tokens);
						if (!stage.rgbWave) { stage.rgbGen = 'identity'; }
						break;
				}
				break;

			case 'alphagen':
				stage.alphaGen = tokens.next().toLowerCase();
				switch (stage.alphaGen) {
					case 'wave':
						stage.alphaWave = parseWaveForm(tokens);
						if (!stage.alphaWave) { stage.alphaGen = '1.0'; }
						break;
					case 'portal':
						script.portalRange = parseFloat(tokens.next().toLowerCase());
						break;
					default: break;
				}
				break;

			case 'alphafunc':
				stage.alphaFunc = tokens.next().toUpperCase();
				break;

			case 'blendfunc':
				stage.blendSrc = tokens.next().toUpperCase();
				stage.hasBlendFunc = true;
				if (!stage.depthWriteOverride) {
					stage.depthWrite = false;
				}
				switch (stage.blendSrc) {
					case 'ADD':
						stage.blendSrc = 'GL_ONE';
						stage.blendDest = 'GL_ONE';
						break;

					case 'BLEND':
						stage.blendSrc = 'GL_SRC_ALPHA';
						stage.blendDest = 'GL_ONE_MINUS_SRC_ALPHA';
						break;

					case 'FILTER':
						stage.blendSrc = 'GL_DST_COLOR';
						stage.blendDest = 'GL_ZERO';
						break;

					default:
						stage.blendDest = tokens.next().toUpperCase();
						break;
				}
				break;

			case 'depthfunc':
				stage.depthFunc = tokens.next().toLowerCase();
				break;

			case 'depthwrite':
				stage.depthWrite = true;
				stage.depthWriteOverride = true;
				break;

			case 'tcmod':
				parseTexMod(tokens, stage);
				break;

			case 'tcgen':
				stage.tcGen = tokens.next();
				break;

			default: break;
		}
	}

	if (stage.blendSrc == 'GL_ONE' && stage.blendDest == 'GL_ZERO') {
		stage.hasBlendFunc = false;
		stage.depthWrite = true;
	}

	// I really really really don't like doing this, which basically just forces lightmaps to use the 'filter' blendmode
	// but if I don't a lot of textures end up looking too bright. I'm sure I'm just missing something, and this shouldn't
	// be needed.
	if (stage.isLightmap && stage.hasBlendFunc) {
		stage.blendSrc = 'GL_DST_COLOR';
		stage.blendDest = 'GL_ZERO';
	}

	script.stages.push(stage);
}

function parseTexMod(tokens, stage) {
	var tcMod = {
		type: tokens.next().toLowerCase()
	};

	switch (tcMod.type) {
		case 'rotate':
			tcMod.angle = parseFloat(tokens.next()) * (3.1415/180);
			break;

		case 'scale':
			tcMod.scaleX = parseFloat(tokens.next());
			tcMod.scaleY = parseFloat(tokens.next());
			break;

		case 'scroll':
			tcMod.sSpeed = parseFloat(tokens.next());
			tcMod.tSpeed = parseFloat(tokens.next());
			break;

		case 'stretch':
			tcMod.wave = parseWaveForm(tokens);
			if (!tcMod.wave) { tcMod.type = null; }
			break;

		case 'turb':
			tcMod.turbulance = new Waveform();
			tcMod.turbulance.base = parseFloat(tokens.next());
			tcMod.turbulance.amp = parseFloat(tokens.next());
			tcMod.turbulance.phase = parseFloat(tokens.next());
			tcMod.turbulance.freq = parseFloat(tokens.next());
			break;

		default:
			tcMod.type = null;
			break;
	}

	if (tcMod.type) {
		stage.tcMods.push(tcMod);
	}
}

function parseWaveForm(tokens) {
	var wave = new Waveform();

	wave.funcName = tokens.next().toLowerCase();
	wave.base = parseFloat(tokens.next());
	wave.amp = parseFloat(tokens.next());
	wave.phase = parseFloat(tokens.next());
	wave.freq = parseFloat(tokens.next());

	return wave;
}

module.exports = {
	SORT:        SORT,

	Shader:      Shader,
	ShaderStage: ShaderStage,
	Deform:      Deform,
	TexMod:      TexMod,
	Waveform:    Waveform,

	loadScript:  loadScript,
	loadShader:  loadShader
};
