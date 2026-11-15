import type { Metadata } from "next";
import { PageShell } from "../_components/site/page-shell";
import { METHOD_SECTIONS, type MethodBlock } from "./_components/method-content";
import { MethodNav } from "./_components/method-nav";

export const metadata: Metadata = {
  title: "Method",
  description: "How the comparison works, what it can find and what it cannot.",
};

function Block({ block }: { block: MethodBlock }) {
  switch (block.kind) {
    case "h":
      return <h4 className="mt-4 text-sm font-medium text-paper first:mt-0">{block.text}</h4>;
    case "p":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul className="grid list-disc gap-1.5 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "formula":
      return (
        <figure className="grid gap-1.5">
          <pre className="overflow-x-auto rounded-md border border-rule px-4 py-3 font-data text-[13px] leading-relaxed whitespace-pre text-paper">{block.text}</pre>
          {block.where && <figcaption className="text-[13px] text-ash">{block.where}</figcaption>}
        </figure>
      );
  }
}

/** Method: how the comparison works and its limits (AGENTS.md principles, PLAN.md chapters 4 and 7). */
export default function MethodPage() {
  return (
    <PageShell>
      <div className="px-14 pt-16">
        <h1 className="text-[56px] font-light tracking-[-0.03em]">Method</h1>
        <p className="mt-3 max-w-2xl text-lg text-ash">How the comparison works, what it can find and what it cannot. Each part starts in plain words; open it for the formulas, the reasons and the references.</p>
      </div>
      <div className="mt-20 grid gap-10 px-14 md:grid-cols-[300px_minmax(0,760px)] md:gap-14">
        <MethodNav sections={METHOD_SECTIONS.map(({ id, title }) => ({ id, title }))} />
        <div className="grid gap-20 border-rule md:border-l md:pl-14">
          {METHOD_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-[26px] font-light tracking-[-0.02em]">{section.title}</h2>
              <div className="mt-4 grid gap-3 text-base leading-[1.55] text-bone">
                {section.simple.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
              <details className="group mt-6 border-t border-rule pt-4">
                <summary className="cursor-pointer text-sm text-ash transition-colors select-none hover:text-paper">
                  <span className="group-open:hidden">Show the full explanation: formulas, reasons and references</span>
                  <span className="hidden group-open:inline">Hide the full explanation</span>
                </summary>
                <div className="mt-5 grid gap-3 text-sm leading-[1.6] text-bone">
                  {section.detail.map((block, index) => (
                    <Block key={index} block={block} />
                  ))}
                  {section.references.length > 0 && (
                    <>
                      <h4 className="mt-4 text-sm font-medium text-paper">References</h4>
                      <ol className="grid list-decimal gap-1.5 pl-5 text-[13px] text-ash">
                        {section.references.map((reference) => (
                          <li key={reference.text}>
                            {reference.href ? (
                              <a href={reference.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-paper">
                                {reference.text}
                              </a>
                            ) : (
                              reference.text
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              </details>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
