import { boot } from "quasar/wrappers";
import { CARPETComponents } from "carpet-component-library";

export default boot(({ app }) => {
  for (const [componentName, component] of Object.entries(CARPETComponents)) {
    app.component(componentName, component as object);
  }
});
