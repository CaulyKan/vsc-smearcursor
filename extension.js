const vscode = require("vscode")
const path = require("path")
const fs = require("fs")

const FILENAME = "smearcursor.js"

function reload() {
	vscode.commands.executeCommand("extension.updateCustomCSS");
	setTimeout(function () {
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}, 500);
}

function enable(ctx) {
	const conf = vscode.workspace.getConfiguration()

	disable(ctx, false)

	const src = path.join(__dirname, FILENAME)
	if (!fs.existsSync(src)) return;
	const target = path.join(__dirname, "_" + FILENAME)

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

	conf.vscode_custom_css.imports.push(`file://${target}`)
	conf.update(
		"vscode_custom_css.imports",
		conf.vscode_custom_css.imports,
		vscode.ConfigurationTarget.Global
	)

	reload()
}

function disable(ctx, do_reload = true) {
	const conf = vscode.workspace.getConfiguration()
	let imports = conf.vscode_custom_css.imports

	let deleted = false
	const to_delete = []
	imports.forEach(f => {
		if (f === null) return
		if (f.includes("_" + FILENAME)) {
			deleted = true
			imports[imports.indexOf(f)] = null
		}
	});
	imports = imports.filter(item => !!item);
	imports = imports.filter(item => item !== null);

	if (deleted === false) return false

	conf.update(
		"vscode_custom_css.imports",
		imports,
		vscode.ConfigurationTarget.Global
	)
	if (do_reload) reload()
}

exports.activate = function (ctx) {
	ctx.subscriptions.push(vscode.commands.registerCommand('smearcursor.enable', enable))
	ctx.subscriptions.push(vscode.commands.registerCommand('smearcursor.disable', disable))
}
