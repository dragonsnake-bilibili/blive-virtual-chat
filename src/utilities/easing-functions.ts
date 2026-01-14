function ease_out_sine(x: number): number {
  return Math.sin((x * Math.PI) / 2);
}

function ease_out_cubic(x: number): number {
  return x * x * x;
}

const easing_functions = {
  ease_out_sine,
  ease_out_cubic,
};
export default easing_functions;
