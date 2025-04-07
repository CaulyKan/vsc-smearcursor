{
	const ANIMATION_TIME = "%<smearcursor.animation_time>%" || 150
	const EASING = '"%<smearcursor.animation_easing>%"' || "linear"
	const MAX_LENGTH = "%<smearcursor.max_length>%" || 9999999
	const TIP_SHRINK = Math.min(Math.max(0, "%<smearcursor.tip_shrink>%" || 0.6), 1)
	const TAIL_SHRINK = Math.min(Math.max(0, "%<smearcursor.tail_shrink>%" || 0.8), 1)

	pow = Math.pow;
	sqrt = Math.sqrt;
	sin = Math.sin;
	cos = Math.cos;
	PI = Math.PI;
	c1 = 1.70158;
	c2 = c1 * 1.525;
	c3 = c1 + 1;
	c4 = (2 * PI) / 3;
	c5 = (2 * PI) / 4.5;

	easings = {
		'linear': (x) => x,
		'quad': (x) => {
			return x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2;
		},
		'cubic': (x) => {
			return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2;
		},
		'quart': (x) => {
			return x < 0.5 ? 8 * x * x * x * x : 1 - pow(-2 * x + 2, 4) / 2;
		},
		'quint': (x) => {
			return x < 0.5 ? 16 * x * x * x * x * x : 1 - pow(-2 * x + 2, 5) / 2;
		},
		'sine': (x) => {
			return -(cos(PI * x) - 1) / 2;
		},
		'expo': (x) => {
			return x === 0
				? 0
				: x === 1
					? 1
					: x < 0.5
						? pow(2, 20 * x - 10) / 2
						: (2 - pow(2, -20 * x + 10)) / 2;
		},
		'circ': (x) => {
			return x < 0.5
				? (1 - sqrt(1 - pow(2 * x, 2))) / 2
				: (sqrt(1 - pow(-2 * x + 2, 2)) + 1) / 2;
		},
		'back': (x) => {
			return x < 0.5
				? (pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
				: (pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
		},
	}

	const get_easing = function (t) {
		return easings[EASING](t)
	}

	function overlaps(a, b) {
		return a.left < b.right
			&& a.right > b.left
			&& a.top < b.bottom
			&& a.bottom > b.top
	}

	function validate(cursor) {
		const visible = cursor.checkVisibility({
			visibilityProperty: true,
			contentVisibilityAuto: true,
		})
		if (!visible) return false
		const bbox = cursor.getBoundingClientRect()
		let view = cursor.closest(".monaco-editor")
		let view_bbox = view.getBoundingClientRect()
		if (!view) return false
		if (!overlaps(bbox, view_bbox)) return false

		let minimap = view.querySelector(".minimap")
		if (minimap) {
			let minimap_bbox = minimap.getBoundingClientRect()
			if (overlaps(bbox, minimap_bbox)) return false
		}

		return true
	}

	function order_points(points) {
		const centroid = points.reduce(
			(acc, point) => ({
				x: acc.x + point.x / points.length,
				y: acc.y + point.y / points.length,
			}),
			{ x: 0, y: 0 }
		)

		return points.sort((a, b) => {
			const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x)
			const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x)
			return angleA - angleB
		})
	}

	function farthest_points(center, points) {
		const distances = points.map(point => ({
			point,
			distance: Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2))
		}))

		distances.sort((a, b) => b.distance - a.distance)
		return [distances[0].point, distances[1].point]
	}

	function get_points(a, b) {
		const ca = { x: (a[0].x + a[2].x) / 2, y: (a[0].y + a[2].y) / 2 }
		const cb = { x: (b[0].x + b[2].x) / 2, y: (b[0].y + b[2].y) / 2 }
		const fa = farthest_points(ca, b)
		const fb = farthest_points(cb, a)
		return order_points([...fa, ...fb])
	}

	function get_dir(a,b) {
		const ca = { x: (a[0].x + a[2].x) / 2, y: (a[0].y + a[2].y) / 2 }
		const cb = { x: (b[0].x + b[2].x) / 2, y: (b[0].y + b[2].y) / 2 }
		const dir = { x: cb.x - ca.x, y: cb.y - ca.y }
		const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y)
		if (len === 0) return { x: 0, y: 0 }
		const normalized = { x: dir.x / len, y: dir.y / len }
		return normalized
	}

	function get_dist(pa,pb) {
		return Math.sqrt((pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2)
	}

	function lerp(a, b, t) {
		return a + (b - a) * t
	}

	function smear(c, delta) {
		c.time -= delta
		c.time = Math.max(c.time, 0)
		const percent = c.time / ANIMATION_TIME

		const w = c.size.x
		const h = c.size.y
		const dx = c.src.x - c.pos.x
		const dy = c.src.y - c.pos.y
		const distance = Math.sqrt(dx * dx + dy * dy) || 1

		let points = [
			{ x: c.pos.x, y: c.pos.y },
			{ x: c.pos.x + w, y: c.pos.y },
			{ x: c.pos.x + w, y: c.pos.y + h },
			{ x: c.pos.x, y: c.pos.y + h },
		]

		if (distance > 1) {
			const t = get_easing(1 - percent)

			const clamped_x = Math.min(MAX_LENGTH, distance) * dx / distance
			const clamped_y = Math.min(MAX_LENGTH, distance) * dy / distance

			c.src = {
				x: c.pos.x + clamped_x,
				y: c.pos.y + clamped_y
			}
			c.smear = {
				x:lerp(c.src.x, c.pos.x, t),
				y:lerp(c.src.y, c.pos.y, t)
			}
			
			function get_rect(x,y,w,h,sx,sy) {
				return [
					{ x: x + sx, y: y + sy },
					{ x: x + w - sx, y: y + sy },
					{ x: x + w - sx, y: y + h - sy },
					{ x: x + sx, y: y + h - sy },
				]
			}

			let tip_x_inset = lerp(w / 2 - w / 2 * TIP_SHRINK, 0, t)
			let tip_y_inset = lerp(h / 2 - h / 2 * TIP_SHRINK, 0, t)
			let tail_x_inset = lerp(w / 2 - w / 2 * TAIL_SHRINK, 0, t)
			let tail_y_inset = lerp(h / 2 - h / 2 * TAIL_SHRINK, 0, t)

			let tip = get_rect(c.pos.x, c.pos.y, w, h, 0, 0)
			let tail = get_rect(c.smear.x, c.smear.y, w, h, 0, 0)
			
			points = get_points(tip, tail)
			const dir = get_dir(tail,tip)
			if (dir.x !== 0 && dir.y !== 0) {
				tip = get_rect(c.pos.x, c.pos.y, w, h, tip_x_inset, tip_y_inset)
				tail = get_rect(c.smear.x, c.smear.y, w, h, tail_x_inset, tail_y_inset)
				points = get_points(tip, tail)
			}
			
			if (t == 1) {
				c.src = Object.assign({}, c.pos)
				c.smear = Object.assign({}, c.pos)
			}
		}
		return points
	}

	function draw(c, ctx, ctr, delta) {
		points = smear(c, delta)
		
		ctx.save()
		ctx.fillStyle = c.background

		ctx.beginPath()
		ctx.moveTo(points[0].x, points[0].y)

		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y)
		}

		ctx.closePath()
		ctx.fill()
		ctx.restore()

		c.els.forEach(el => {
			if (!el.parentNode) return
			if (!el.parentNode.classList.contains("cursor-block-style")) return

			const clone = el.cloneNode(true)
			clone.style.left = c.pos.x + "px"
			clone.style.top = c.pos.y + "px"
			clone.style.position = "fixed"
			clone.style.zIndex = 2
			clone.style.color = c.color
			ctr.appendChild(clone)
		})
	}

	function get_float_value(el, property) {
		return parseFloat(getComputedStyle(el).getPropertyValue(property).replace("px", ""))
	}

	function assign(cursor, idx) {
		cursor.style.backgroundColor = "transparent"

		if (!validate(cursor)) return

		const c = active_cursors[idx] || {}
		const cp = cursor.getBoundingClientRect()

		c.pos = { x: cp.left, y: cp.top }
		c.size = { x: cursor.offsetWidth, y: cursor.offsetHeight }
		c.background = getComputedStyle(
			document.querySelector("body>.monaco-workbench"))
			.getPropertyValue("--vscode-editorCursor-foreground")
			.trim()
		c.color = getComputedStyle(
			document.querySelector("body>.monaco-workbench"))
			.getPropertyValue("--vscode-editorCursor-background")
			.trim()
		c.last_pos = c.last_pos || Object.assign({}, c.pos)
		c.smear = c.smear || Object.assign({}, c.pos)
		c.src = c.src || Object.assign({}, c.pos)
		c.time = c.time || 0
		c.els = []
		if (!c.els.includes(cursor)) {
			c.els.push(cursor)
		}

		if (c.last_pos.x !== cp.left || c.last_pos.y !== cp.top) {
			c.time = ANIMATION_TIME
			c.smear = Object.assign({}, c.last_pos)
			c.src = Object.assign({}, c.last_pos)
			c.last_pos = Object.assign({}, c.pos)
		}
		active_cursors[idx] = c
	}


	function create_elements(editor) {
		const container = document.querySelector(".monaco-grid-view")
		const container_bbox = container.getBoundingClientRect()

		let canvas = container.querySelector(`.cursor-trails`)
		if (!canvas) {
			const c = document.createElement('canvas')
			c.className = "cursor-trails"
			c.style.position = "fixed"
			c.style.pointerEvents = "none"
			c.style.top = 0
			c.style.left = 0
			c.style.zIndex = 1
			container.insertBefore(c, container.firstChild)
			canvas = c
		}

		canvas.width = container_bbox.width
		canvas.height = container_bbox.height
		const ctx = canvas.getContext('2d')
		ctx.clearRect(0, 0, canvas.width, canvas.height)

		let ctr = document.querySelector(".cursor-container")
		if (!ctr) {
			ctr = document.createElement("div")
			ctr.className = "cursor-container"
			ctr.style.position = "fixed"
			ctr.style.pointerEvents = "none"
			ctr.style.top = 0
			ctr.style.left = 0
			ctr.style.zIndex = 2

			document.body.appendChild(ctr)
		}

		ctr.innerHTML = ""

		return { ctx, ctr }
	}

	const anim = requestAnimationFrame || (callback => setTimeout(callback, 1000 / 60))
	let active_cursors = []
	async function run() {
		let editor
		let last
		let delta

		function rr(stamp) {
			last = stamp
			anim(step)
		}

		function step(stamp) {
			try {
				delta = (stamp - last)
				editor = document.querySelector(".part.editor")
				if (editor === null) return rr(stamp)
				const { ctx, ctr } = create_elements(editor)

				const cursors = Array.from(editor.getElementsByClassName("cursor"))

				if (cursors.length === 0) return rr(stamp)
				let idx = 0

				cursors.forEach(cursor => {
					if (cursor.classList.contains("cursor-secondary")) idx++
					assign(cursor, idx)
				})

				active_cursors.forEach(cursor => {
					cursor.els.forEach(el => {
						if (!el.isConnected) cursor.els = cursor.els.filter(e => e !== el)
					})
					if (cursor.els.length === 0) {
						active_cursors = active_cursors.filter(c => c !== cursor)
						return
					}

					draw(cursor, ctx, ctr, delta)
				})

				rr(stamp)
			} catch (e) {
				console.log("DBG: ERR: ", e)
				rr(stamp)
			}
		}

		anim(step)
	}

	run()
}