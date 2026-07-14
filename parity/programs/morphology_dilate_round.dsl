search synth, filter
noise(seed: 1, scaleX: 50, scaleY: 50).morphology(mode: dilate, shape: round).write(o0)
render(o0)
