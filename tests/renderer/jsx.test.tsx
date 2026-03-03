// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

describe("Vanilla JSX Factory", () => {
  it("should create a basic element", () => {
    const el = <div className="test">Hello</div> as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("class")).toBe("test");
    expect(el.textContent).toBe("Hello");
  });

  it("should handle nested children", () => {
    const el = (
      <div id="parent">
        <span>Child 1</span>
        <span>Child 2</span>
      </div>
    ) as HTMLElement;
    expect(el.children.length).toBe(2);
    expect(el.children[0].tagName).toBe("SPAN");
    expect(el.children[1].textContent).toBe("Child 2");
  });

  it("should handle style objects", () => {
    const el = <div style={{ color: "red", fontSize: "12px" }}>Styled</div> as HTMLElement;
    expect(el.style.color).toBe("red");
    expect(el.style.fontSize).toBe("12px");
  });

  it("should handle event listeners", () => {
    let clicked = false;
    const el = <button onClick={() => (clicked = true)}>Click me</button> as HTMLElement;
    el.click();
    expect(clicked).toBe(true);
  });

  it("should handle Fragments", () => {
    const frag = (
      <>
        <div>1</div>
        <div>2</div>
      </>
    ) as DocumentFragment;
    expect(frag.children.length).toBe(2);
    expect(frag.children[0].textContent).toBe("1");
    expect(frag.children[1].textContent).toBe("2");
  });

  it("should handle Function components", () => {
    const MyComp = ({ name, children }: { name: string; children?: any }) => (
      <div title={name}>{children}</div>
    );
    const el = <MyComp name="test-name">Functional Content</MyComp> as HTMLElement;
    expect(el.getAttribute("title")).toBe("test-name");
    expect(el.textContent).toBe("Functional Content");
  });

  it("should handle refs", () => {
    let captured: HTMLElement | null = null;
    const el = <div ref={(e) => (captured = e)}>Ref Me</div> as HTMLElement;
    expect(captured).toBe(el);
  });
});
