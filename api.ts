import { bo } from "./backend";
import * as backprop from "./backprop";
export { backend } from "./backend";
import { convert, Tensor } from "./tensor";
export { Tensor } from "./tensor";
import * as ops from "./ops";
import * as types from "./types";
import { assert, assertShapesEqual } from "./util";

// Turns a javascript array of numbers
// into a tensor. Like this:
//
//    let tensor = $([[1, 2, 3],
//                    [4, 5, 6]]);
//    console.log(tensor.square());
//
// If a tensor is given to $, it simply returns it.
export function $(t: types.TensorLike, dtype?: types.DType): Tensor {
  return convert(t, dtype);
}

// grad(f) returns a gradient function. If f is a function that maps
// R^n to R^m, then the gradient function maps R^n to R^n.
// When evaluated at a point, it gives the slope in each dimension of
// the function f. For example:
//
//   let f = (x) => $(x).square();
//
// Then grad(f) is 2*x (being the derivative of x^2).
//
//   g = grad(f);
//   g(10) // is 2 * 10
export const grad = backprop.grad;
export const multigrad = backprop.multigrad;
export const multigradAndVal = backprop.multigradAndVal;
export const gradAndVal = backprop.gradAndVal;

// Returns the identity matrix of a given size.
export function eye(size: number, dtype: types.DType = "float32"): Tensor {
  const t = bo.eye(size, dtype);
  return new Tensor(t);
}

// Returns num evenly spaced samples, calculated over the interval
// [start, stop].
export const linspace = (start: number, stop: number, num = 50): Tensor => {
  const t = bo.linspace(start, stop, num);
  return new Tensor(t);
};

// Return evenly spaced numbers over a specified interval.
export const arange = function(...args: number[]): Tensor {
  let start: number, limit: number, delta: number;
  switch (args.length) {
    case 1:
      start = 0;
      limit = args[0];
      delta = 1;
      break;

    case 2:
      start = args[0];
      limit = args[1];
      delta = 1;
      break;

    case 3:
      start = args[0];
      limit = args[1];
      delta = args[2];
      break;

    default:
      throw new Error("Bad number of arguments.");
  }
  const t = bo.arange(start, limit, delta);
  return new Tensor(t);
};

export function randn(shape: number[]): Tensor {
  const t = bo.randn(shape);
  return new Tensor(t);
}

// fill returns a new tensor of the given shape, filled with constant values
// specified by the `value` argument. `value` must be a scalar tensor.
export function fill(value: types.TensorLike, shape: types.Shape): Tensor {
  return ops.fill($(value), shape);
}

// Return a new tensor of given shape and dtype, filled with zeros.
export function zeros(shape: types.Shape,
                      dtype: types.DType = "float32"): Tensor {
  return ops.zeros(shape, dtype);
}

// Return a new tensor of given shape and dtype, filled with ones.
export function ones(shape: types.Shape,
                     dtype: types.DType = "float32"): Tensor {
  return ops.ones(shape, dtype);
}

export const matmul = (x, y) => $(x).matmul(y);

export interface ArgsSGD {
  lossFn: (...params: Tensor[]) => Tensor;
  params: Tensor[];
  callback: (step: number, params: Tensor[], loss: Tensor) => void;
  learningRate: number;
  steps: number;
  momentum: number;
}

// Stochastic gradient descent with momentum.
export function sgd(args: ArgsSGD) {
  const m = args.momentum;
  assert(0 <= m && m <= 1.0);
  const params = args.params;
  // Get gradient of objective using autograd.
  const lossGradVal = multigradAndVal(args.lossFn);
  const velocity = params.map((p) => p.zerosLike());
  // Training loop.
  for (let step = 0; step < args.steps; step++) {
    // Forward/Backward pass
    const [pGrads, loss] = lossGradVal(...params);
    assert(loss.rank === 0);
    assert(pGrads.length === params.length);
    // Update each param tensor.
    for (let j = 0; j < params.length; j++) {
      assertShapesEqual(params[j].shape, pGrads[j].shape);
      velocity[j] = velocity[j].mul(m).sub(pGrads[j].mul(1 - m));
      params[j] = params[j].add(velocity[j].mul(args.learningRate));
    }
    if (args.callback) args.callback(step, params, loss);
  }
  return params;
}
