<template>
  <nav class="navigation">
    <div
      class="traverse backward"
      v-if="!isRootNode"
      data-direction="backward"
      :data-to="previous"
      @click="navigate"
    >
      <div class="validity">&#10004;</div>
      <p>&#9658;</p>
    </div>
    <div
      class="traverse forward"
      v-if="next"
      data-direction="forward"
      :data-to="next"
      @click="navigate"
    >
      <div class="validity">&#33;</div>
      <p>&#9658;</p>
    </div>
  </nav>
</template>

<script lang="ts" setup>
import { onMounted, computed, watch, unref } from "vue";
import { useRouter } from "vue-router";
import type {
  StoreAPI,
  SerializedCARPETComponents,
} from "carpet-component-library";
import { SerialisedComponents } from "src/stores/applicationStore";

const props = defineProps<{ storeObject: StoreAPI }>();

const { getProperty, setProperty } = props.storeObject;

const taskMode = getProperty("$.taskMode");
const router = useRouter();
const rootNode = getProperty("$.rootNode");
const currentNode = getProperty("$.currentNode");

const next = computed(() => {
  const edges = getProperty("$.edges")[currentNode];
  if (edges) return edges[0];
  return null;
});
const previous = computed(() => {
  return getProperty("$.previousNode");
});

const isRootNode = rootNode == currentNode;

const findPrevious = (to: number) => {
  const edges: { [id: number]: Array<number> } = getProperty("$.edges");

  const previousId = Object.entries(edges).reduce(
    (previousId, [nodeId, toIds]) => {
      if (toIds.includes(to)) previousId = parseInt(nodeId);
      return previousId;
    },
    -1,
  );

  return previousId;
};

// type ComponentValidites = Array<boolean>;

const components = computed(
  () => <SerialisedComponents>getProperty(`$.nodes.${currentNode}.components`),
);

// const componentValidities: ComputedRef<ComponentValidites> = computed(() => {
//   const edges = getProperty("$.edges");
//   if (edges && edges[currentNode]) {
//     if (edges[currentNode].length > 1) return [true];
//     const components = <TaskGraphState>(
//       getProperty(`$.nodes.${currentNode}.components`)
//     );
//     if (components)
//       return Object.values(components).map((component) => {
//         if (taskMode === "practice") {
//           return component.isValid && "isCorrect" in component
//             ? component.isCorrect
//             : true;
//         } else {
//           return component.isValid;
//         }
//       });
//   }
//   return [false];
// });

const validateComponents = () => {
  const isCorrect = (<Array<SerializedCARPETComponents>>(
    Object.values(unref(components))
  )).every((component) => {
    // not every component requires a correctness check, so skip those

    if (component.state.isCorrect === undefined) return true;
    return component.state.isCorrect;
  });
  const isValid =
    taskMode.value === "practice"
      ? isCorrect &&
        (<Array<SerializedCARPETComponents>>(
          Object.values(unref(components))
        )).every((component) => component.state.isValid)
      : (<Array<SerializedCARPETComponents>>(
          Object.values(unref(components))
        )).every((component) => component.state.isValid);

  return { isValid, isCorrect };
};

const controlNavigationGuard = (isValid: boolean) => {
  const navForwards: Array<HTMLElement> = Array.from(
    document.querySelectorAll(".traverse.forward"),
  );
  navForwards.forEach((navForward) => {
    const validityElement = <HTMLElement>navForward.querySelector(".validity");
    if (isValid) {
      navForward.classList.remove("inValid");
      validityElement.innerHTML = "&#10004;";
    } else if (validityElement) {
      navForward.classList.add("inValid");
      validityElement.innerHTML = "&#33;";
    }
  });
};

onMounted(() => {
  const { isValid } = validateComponents();

  controlNavigationGuard(isValid);
});

watch(
  components,
  () => {
    setTimeout(() => {
      const { isValid, isCorrect } = validateComponents();
      const currentNodeElement = getProperty(`$.nodes.${currentNode}`);
      setProperty({ path: `$.nodes.${currentNode}.isValid`, value: isValid });
      if ("isCorrect" in currentNodeElement)
        setProperty({
          path: `$.nodes.${currentNode}.isCorrect`,
          value: isCorrect,
        });

      controlNavigationGuard(isValid);
    }, 50);
  },
  { deep: true },
);

const navigate = (event: Event) => {
  const navElement = <HTMLElement>event.currentTarget;
  const { direction, to } = <{ direction: string; to: string }>(
    navElement.dataset
  );

  const previousId = findPrevious(parseInt(to));

  if (!to && direction === "backward") {
    router.push({ name: "TaskOverview" });
  } else if (!Array.from(navElement.classList).includes("inValid")) {
    setProperty({ path: "$.previousNode", value: previousId });
    setProperty({ path: "$.currentNode", value: to });
  }
};
</script>

<style scoped>
.navigation {
  position: absolute;
  width: 100px;
  height: 100px;
  bottom: 20px;
  left: 20px;
  display: flex;
  z-index: 5;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
}

.traverse {
  display: flex;
  width: 80%;
  height: 30%;
  align-items: center;
  justify-content: space-around;
  font-size: 20px;
  border: 1px solid black;
  background: #57636b;
  box-shadow: 2px 3px 9px 0px rgba(0, 0, 0, 1);
  text-shadow: 1px 1px 1px #b1b2b4;
  font-weight: bold;
  cursor: auto;
  border-radius: 5px;
}

.traverse p {
  margin-top: auto;
  margin-right: auto;
  cursor: pointer;
  color: #f1ad2d;
}

.backward p {
  transform: rotate(270deg);
}

.forward p {
  transform: rotate(90deg);
}

.inValid p {
  opacity: 0.6;
  cursor: not-allowed;
}

.validity {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  margin-right: auto;
  width: 2vw;
  background: green;
}

.inValid .validity {
  background: red;
  cursor: auto;
}
</style>
