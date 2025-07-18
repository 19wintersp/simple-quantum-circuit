const EPSILON = 0.00001;
const zeroish = (n: number) => Math.abs(n) < EPSILON;


export class Complex {
	re: number;
	im: number;

	static readonly ZERO = new Complex(0, 0);
	static readonly ONE  = new Complex(1, 0);
	static readonly POS  = new Complex(Math.SQRT1_2, 0);
	static readonly NEG  = new Complex(-Math.SQRT1_2, 0);

	constructor(re_: number, im_: number) {
		this.re = re_;
		this.im = im_;
	}

	norm_sqr = () => this.re * this.re + this.im * this.im;
	square   = () => this.re * this.re - this.im * this.im;

	approx = (ref: Complex) => zeroish(ref.re - this.re) && zeroish(ref.im - this.im);

	static add = (l: Complex, r: Complex) =>
		new Complex(l.re + r.re, l.im + r.im);
	static mul = (l: Complex, r: Complex) =>
		new Complex(l.re * r.re - l.im * r.im, l.re * r.im + l.im * r.re);

	toJSON = () => [this.re, this.im];
	static fromJSON = ([re, im]: number[]) => new Complex(re, im);
}

export class Qubit {
	zero: Complex;
	one:  Complex;

	static readonly ZERO = new Qubit(Complex.ONE,  Complex.ZERO);
	static readonly ONE  = new Qubit(Complex.ZERO, Complex.ONE);
	static readonly POS  = new Qubit(Complex.POS,  Complex.POS);
	static readonly NEG  = new Qubit(Complex.POS,  Complex.NEG);

	constructor(zero_: Complex, one_: Complex) {
		this.zero = zero_;
		this.one  = one_;
	}

	register = () => Register.fromUnentangled([this]);

	approx = (ref: Qubit) => this.zero.approx(ref.zero) && this.one.approx(ref.one);

	toJSON = () => [this.zero, this.one];
	static fromJSON = ([zero, one]: number[][]) =>
		new Qubit(Complex.fromJSON(zero), Complex.fromJSON(one));
}

export class Register {
	states: Complex[];

	constructor(states_: Complex[]) {
		this.states = states_.map((v) => v);
	}

	// little-endian
	static fromUnentangled = (qubits: Qubit[]): Register => {
		const states = Array(1 << qubits.length).fill(Complex.ZERO);

		states[0] = qubits[0].zero;
		states[1] = qubits[0].one;

		for (let i = 1; i < qubits.length; i++) {
			const mid = 1 << i;
			for (let j = 0; j < mid; j++) {
				states[mid + j] = Complex.mul(states[j], qubits[i].one);
				states[j] = Complex.mul(states[j], qubits[i].zero);
			}
		}

		return new Register(states);
	};

	copy = () => new Register(this.states);

	// little-endian zero-indexed
	map(selection: number[], f: (register: Register) => Register) {
		const n = Math.log2(this.states.length);
		const m = selection.length;

		const mask = selection
			.map((n) => 1 << n)
			.reduce((a, b) => a | b);
		let bits = 0;

		for (let j = 0; j < (1 << (n - m)); j++) {
			const indices = Array(1 << m);
			const states = Array(1 << m)
				.fill(null)
				.map((_, p) => {
					let i = bits;
					i |= Array(m)
						.fill(null)
						.map((_, bit) => bit)
						.filter((bit) => (p >> bit) & 1)
						.map((bit) => 1 << selection[bit])
						.reduce((a, b) => a | b, 0);

					indices[p] = i;
					return this.states[i];
				});

			const register = f(new Register(states));

			for (let p = 0; p < 1 << m; p++)
				this.states[indices[p]] = register.states[p];

			while (++bits & mask);
		}
	}

	normalise() {
		const square_sum = this.states
			.map((v) => v.square())
			.reduce((a, b) => a + b);
		const scale = new Complex(1 / Math.sqrt(square_sum), 0);

		for (let i = 0; i < this.states.length; i++)
			this.states[i] = Complex.mul(this.states[i], scale);
	}

	aggregate = (s: number) =>
		this.states
			.filter((_, i) => i & (1 << s))
			.map((v) => v.norm_sqr())
			.reduce((a, b) => a + b);

	collapse(s: number) {
		const n = Math.log2(this.states.length);

		const prob1 = this.aggregate(s);
		const state = prob1 < 0.5; //Math.random();
		console.log(`collapse ${prob1}`);

		for (let i = 0; i < 1 << n; i++)
			if (((i & (1 << s)) > 0) == state)
				this.states[i] = Complex.ZERO;

		this.normalise();
	}

	aggregate_all(...ss: number[]) {
		const mask = ss.map((s) => 1 << s).reduce((a, b) => a | b);
		return this.states
			.filter((_, i) => (i & mask) == mask)
			.map((v) => v.norm_sqr())
			.reduce((a, b) => a + b);
	}

	independent = (...ss: number[]): boolean =>
		ss.length > 1
			? zeroish(
					this.aggregate_all(...ss)
						- ss.map((s) => this.aggregate(s)).reduce((a, b) => a * b)
				)
			: Array(Math.log2(this.states.length))
					.fill(null)
					.map((_, i) => i)
					.every((s) => s == ss[0] || this.independent(s, ss[0]));
}


export interface Gate {
	forward(): (register: Register) => Register;
	// reverse(): (register: Register) => Register;
}

export class StaticGate implements Gate {
	matrix: Complex[][];

	static readonly X = new StaticGate([
		[Complex.ZERO, Complex.ONE],
		[Complex.ONE,  Complex.ZERO],
	]);
	static readonly Y = new StaticGate([
		[Complex.ZERO,      new Complex(0, -1)],
		[new Complex(1, 0), Complex.ZERO],
	]);
	static readonly Z = new StaticGate([
		[Complex.ONE,  Complex.ZERO],
		[Complex.ZERO, new Complex(-1, 0)],
	]);
	static readonly H = new StaticGate([
		[Complex.POS, Complex.POS],
		[Complex.POS, Complex.NEG],
	]);
	static readonly S = new StaticGate([
		[Complex.ONE,  Complex.ZERO],
		[Complex.ZERO, new Complex(1, 0)],
	]);
	static readonly T = new StaticGate([
		[Complex.ONE,  Complex.ZERO],
		[Complex.ZERO, new Complex(Math.SQRT1_2, Math.SQRT1_2)],
	]);

	static readonly CX = new StaticGate([
		[Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
		[Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO],
	]);
	static readonly CZ = new StaticGate([
		[Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, new Complex(-1, 0)],
	]);
	static readonly SWAP = new StaticGate([
		[Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO],
		[Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
	]);

	static readonly CCX = new StaticGate([
		[Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO, Complex.ZERO],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
		[Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE,  Complex.ZERO],
	]);

	constructor(matrix_: Complex[][]) {
		this.matrix = matrix_;
	}

	static identity = (width: number) =>
		new StaticGate(
			Array(1 << width)
				.fill(null)
				.map((_, y) =>
					Array(1 << width)
						.fill(null)
						.map((_, x) => new Complex(x == y ? 1 : 0, 0))
				)
		);

	forward = () =>
		(register: Register) => new Register(
			this.matrix.map((row) =>
				row
				.map((v, i) => Complex.mul(v, register.states[i]))
				.reduce((a, b) => Complex.add(a, b))
			)
		);
}


export type Block =
	| {
		type: "repeat-begin" | "medium";
	}
	| {
		type: "repeat-end";
		count: number;
	}
	| {
		type: "measure";
		bind: number;
	}
	| {
		type: "gate";
		gate: GateId;
		binds: number[];
	}
	| {
		type: "oracle";
		width: number;
		match: number;
		firstBind: number;
		xBind: number;
	};

export type GateId =
	| "x" | "y" | "z" | "h" | "s" | "t" | "cx" | "cz" | "swap" | "ccx";

export type GateBlock = {
	name: string;
	binds: string[];
	gate: Gate;
};

export const GATE_BLOCKS: { [id in GateId]: GateBlock } = {
	"x": {
		name: "Pauli X",
		binds: ["X"],
		gate: StaticGate.X,
	},
	"y": {
		name: "Pauli Y",
		binds: ["Y"],
		gate: StaticGate.Y,
	},
	"z": {
		name: "Pauli Z",
		binds: ["Z"],
		gate: StaticGate.Z,
	},
	"h": {
		name: "Hadamard",
		binds: ["H"],
		gate: StaticGate.H,
	},
	"s": {
		name: "Phase 90°",
		binds: ["S"],
		gate: StaticGate.S,
	},
	"t": {
		name: "Phase 45°",
		binds: ["T"],
		gate: StaticGate.T,
	},
	"cx": {
		name: "Controlled X",
		binds: ["X", "C"],
		gate: StaticGate.CX,
	},
	"cz": {
		name: "Controlled Z",
		binds: ["Z", "C"],
		gate: StaticGate.CZ,
	},
	"swap": {
		name: "Swap",
		binds: ["1", "2"],
		gate: StaticGate.SWAP,
	},
	"ccx": {
		name: "Toffoli",
		binds: ["X", "C1", "C2"],
		gate: StaticGate.CCX,
	},
};


export type Tile =
	| {
			type: "measure";
			inverse: boolean;
		}
	| ({
			type: "repeat";
			connect: Connect;
		} & (
			{
				side: "begin";
			} | {
				side: "end";
				count: number;
			}
		) & Wired)
	| ({
			type: "wire";
			crossing: "wire" | "gate" | null;
		} & Wired)
	| ({
			type: "control";
			control: Connect;
			negative: boolean;
		} & Wired)
	| ({
			type: "swap";
			control: Connect;
		} & Wired)
	| ({
			type: "gate";
			label: string | null;
			input: string | null;
			connect: Connect;
			control: Connect;
		} & Wired);

type Wired = {
	wire: Wire;
};

export type Connect = {
	up: boolean;
	down: boolean;
};

export type Wire = "quantum" | "classical";
