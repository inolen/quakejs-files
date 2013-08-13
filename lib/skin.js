var Skin = function () {
	this.name     = null;
	this.surfaces = [];
};

var SkinSurface = function () {
	this.name       = null;
	this.shaderName = null;
	this.shader     = null;
};

function load(data) {
	var skin = new Skin();
	skin.name = name;

	var steps = [];

	// Trim before we split.
	var lines = data.replace(/^\s+|\s+$/g,'').split(/\r\n/);

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var split = line.split(/,/);
		var surfaceName = split[0].toLowerCase();
		var shaderName = split[1];

		if (surfaceName.indexOf('tag_') !== -1) {
			continue;
		}

		var surface = new SkinSurface();
		surface.name = surfaceName;
		surface.shaderName = shaderName;

		skin.surfaces.push(surface);
	}

	return skin;
}

module.exports = {
	load: load
};