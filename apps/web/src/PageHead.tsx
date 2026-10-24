import { For, onCleanup, onMount } from "solid-js";
import { isServer, useAssets } from "solid-js/web";

export interface PageMeta {
  name?: string;
  property?: string;
  content: string;
}

interface PageHeadProps {
  title: string;
  meta: PageMeta[];
}

function metaSelector(meta: PageMeta) {
  return meta.property
    ? `meta[property="${meta.property}"]`
    : `meta[name="${meta.name}"]`;
}

// @solidjs/meta ships without license text, so pages manage their own head:
// prerendering writes the tags, and client navigation swaps them per route.
export function PageHead(props: PageHeadProps) {
  if (isServer) {
    useAssets(() => (
      <>
        <title>{props.title}</title>
        <For each={props.meta}>
          {(meta) => (
            <meta
              name={meta.name}
              property={meta.property}
              content={meta.content}
            />
          )}
        </For>
      </>
    ));
    return null;
  }

  onMount(() => {
    document.title = props.title;
    const owned = props.meta.map((meta) => {
      let element = document.head.querySelector<HTMLMetaElement>(
        metaSelector(meta),
      );
      if (!element) {
        element = document.createElement("meta");
        if (meta.property) element.setAttribute("property", meta.property);
        else if (meta.name) element.name = meta.name;
        document.head.append(element);
      }
      element.content = meta.content;
      return element;
    });
    onCleanup(() => owned.forEach((element) => element.remove()));
  });
  return null;
}
