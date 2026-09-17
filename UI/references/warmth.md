# 4. Warmth, without a photograph (decided 2026-09-14)

<!-- Moved out of the CLAUDE.md beside it on 2026-09-17. Anthropic's guidance is to target under 200 lines, because a longer file consumes more context and reduces adherence to itself. A sibling file loads only when somebody opens it, which an @import would not. See ARCHITECTURE.md section 1. Nothing was cut. -->

**Colour and light, not an image.** A photograph behind a working screen fights the text and dates
within a year. The ground is already warm: `#fafaf8` is a warm off-white, not a cold grey.

Two soft pools of berry at very low opacity, high on the page, fading out before any content
starts:

```css
.shell-top{
  background:
    radial-gradient(900px 320px at 18% -60px, rgba(166,30,77,.075), transparent 70%),
    radial-gradient(680px 260px at 82% -40px, rgba(166,30,77,.045), transparent 70%),
    var(--paper);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .shell-top{
    background:
      radial-gradient(900px 320px at 18% -60px, rgba(201,55,106,.16), transparent 70%),
      radial-gradient(680px 260px at 82% -40px, rgba(201,55,106,.10), transparent 70%),
      var(--paper);
  }
}
```

**Rules.** Berry only, no invented colours. It never sits behind body text, a table or a document.
It fades to nothing by roughly 360px. It does not animate. If it makes anything harder to read,
it is too strong.
