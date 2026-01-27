function ease_out_sine(x: number): number {
  return Math.sin((x * Math.PI) / 2);
}

function ease_out_cubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function ease_in_out_quad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// larger a leads to higher peak value that occurs earlier
function create_ease_out_back(a: number): (x: number) => number {
  return (x) => 1 + (a + 1) * Math.pow(x - 1, 3) + a * Math.pow(x - 1, 2);
}

const easing_functions = {
  ease_out_sine,
  ease_out_cubic,
  ease_in_out_quad,
  create_ease_out_back,
  ease_out_back: create_ease_out_back(Math.sqrt(3)),
};
export default easing_functions;
