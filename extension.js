const vscode = require("vscode")
const path = require("path")
const fs = require("fs")


function add_file(file) {
	file = require("path").join(__dirname, file)
	const f = `file://${file}`
	const conf = vscode.workspace.getConfiguration()
	if (conf.vscode_custom_css.imports.includes(f)) return

	conf.vscode_custom_css.imports.push(f)

	conf.update(
		"vscode_custom_css.imports",
		conf.vscode_custom_css.imports,
		vscode.ConfigurationTarget.Global
	)
}

function remove_file(file) {
	file = require("path").join(__dirname, file)
	const f = `file://${file}`
	const conf = vscode.workspace.getConfiguration()
	if (!conf.vscode_custom_css.imports.includes(f)) return

	conf.vscode_custom_css.imports = conf.vscode_custom_css.imports.filter((i) => i !== f)

	conf.update(
		"vscode_custom_css.imports",
		conf.vscode_custom_css.imports,
		vscode.ConfigurationTarget.Global
	)
}

function copy_file(name) {
	const src = path.join(__dirname, name)
	if (!fs.existsSync(src)) return;
	const target = path.join(__dirname, "_" + name)

	let content = fs.readFileSync(src, "utf-8")

	const regex = /("|')%<.*?>%("|')/gms
	let match = content.match(regex)

	if (match) {
		match.forEach((m) => {
			let setting = m.slice(3, -3).split(".")
			let value = vscode.workspace.getConfiguration(setting[0]).get(setting[1])
			content = content.replace(m, value)
		})
	}

	fs.writeFileSync(target, content)
}

function reload() {
	vscode.commands.executeCommand("extension.updateCustomCSS");
	setTimeout(function () {
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}, 500);
}

function enable(ctx) {
	copy_file("smearcursor.js")
	add_file("_smearcursor.js")
	reload()
}

function disable(ctx) {
	remove_file("_smearcursor.js")
	reload()
}

exports.activate = function (ctx) {
	ctx.subscriptions.push(vscode.commands.registerCommand('smearcursor.enable', enable))
	ctx.subscriptions.push(vscode.commands.registerCommand('smearcursor.disable', disable))
}
