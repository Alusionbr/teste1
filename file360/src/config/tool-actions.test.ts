import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findToolAction, isToolActionAvailable, TOOL_ACTIONS } from "./tool-actions.ts";

describe("catálogo de ações", () => {
  it("mantém ids e rotas únicos", () => {
    assert.equal(new Set(TOOL_ACTIONS.map((action) => action.id)).size, TOOL_ACTIONS.length);
    const routes = TOOL_ACTIONS.flatMap((action) => action.route ? [`${action.route.group}/${action.route.slug}`] : []);
    assert.equal(new Set(routes).size, routes.length);
  });

  it("não oferece ações incompatíveis com a entrada", () => {
    const removeAudio = findToolAction("remove-video-audio")!;
    assert.equal(isToolActionAvailable(removeAudio, [{ name: "clip.mp4", type: "video/mp4" }]), true);
    assert.equal(isToolActionAvailable(removeAudio, [{ name: "voz.mp3", type: "audio/mpeg" }]), false);
  });

  it("expressa os quatro objetivos principais", () => {
    assert.deepEqual(
      TOOL_ACTIONS.filter((action) => action.featured).map((action) => action.name),
      ["Reduzir tamanho", "Juntar em PDF", "Tirar o som", "Criar GIF"],
    );
  });
});
