import type { SceneVariant } from "./typing";

const variant_loaders = import.meta.glob("./scene-*.ts");
const intermediate = (await Promise.all(
  Object.values(variant_loaders).map((loader) => loader()),
)) as any[];
const SceneVariants = intermediate.map(
  (item) => item.default,
) as SceneVariant[];

export default SceneVariants;
