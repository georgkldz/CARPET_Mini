import { boot } from "quasar/wrappers";
import { CustomComponents } from "src/components";

export default boot(({ app }) => {
  for (const [componentName, component] of Object.entries(CustomComponents)) {
    app.component(componentName, component as object);
  }
});
