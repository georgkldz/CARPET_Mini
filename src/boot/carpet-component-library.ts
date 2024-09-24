import { boot } from "quasar/wrappers";
import { DOTGraph } from "carpet-component-library";

export default boot(({ app }) => {
  // for (const [x, y] of Object.entries(components)) {
  //     console.log("TADA:", x, y);
  //   }
  app.component("DOTGraph", DOTGraph as object);
});
