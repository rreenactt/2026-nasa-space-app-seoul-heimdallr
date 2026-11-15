import type { Metadata } from "next";
import type { MessageKey } from "../_i18n/message-keys";
import { getLocale, getT } from "../_i18n/server";
import { PageShell } from "../_components/site/page-shell";
import { METHOD_SECTIONS, type MethodBlock } from "./_components/method-content";
import { MethodNav } from "./_components/method-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: "Method", description: t("method.intro") };
}

function Block({ block, t }: { block: MethodBlock; t: (key: MessageKey) => string }) {
  switch (block.kind) {
    case "h":
      return <h4 className="mt-4 text-sm font-medium text-paper first:mt-0">{t(block.text)}</h4>;
    case "p":
      return <p>{t(block.text)}</p>;
    case "list":
      return (
        <ul className="grid list-disc gap-1.5 pl-5">
          {block.items.map((item) => (
            <li key={item}>{t(item)}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <figure className="grid gap-1.5">
          <div className="overflow-x-auto rounded-md border border-rule">
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px] leading-snug">
              <thead>
                <tr className="border-b border-rule text-paper">
                  {block.head.map((cell) => (
                    <th key={cell} scope="col" className="px-3 py-2 font-medium">{t(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row[0]} className="border-b border-rule align-top last:border-b-0">
                    {row.map((cell, index) => (
                      <td key={index} className={index < 2 ? "px-3 py-2 font-data whitespace-nowrap text-paper" : "px-3 py-2"}>{index < 2 ? cell : t(cell as MessageKey)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && <figcaption className="text-[13px] text-ash">{t(block.note)}</figcaption>}
        </figure>
      );
    case "formula":
      return (
        <figure className="grid gap-1.5">
          <pre className="overflow-x-auto rounded-md border border-rule px-4 py-3 font-data text-[13px] leading-relaxed whitespace-pre text-paper">{block.text}</pre>
          {block.where && <figcaption className="text-[13px] text-ash">{t(block.where)}</figcaption>}
        </figure>
      );
  }
}

/** Method: how the comparison works and its limits (AGENTS.md principles, PLAN.md chapters 4 and 7). */
export default async function MethodPage() {
  const t = await getT();
  // The references (paper titles) are English only; mark them so screen readers read them as English.
  const referenceLang = (await getLocale()) === "en" ? undefined : "en";
  return (
    <PageShell>
      <div className="px-14 pt-16">
        <h1 className="text-[56px] font-light tracking-[-0.03em]">Method</h1>
        <p className="mt-3 max-w-2xl text-lg text-ash">{t("method.intro")}</p>
      </div>
      <div className="mt-20 grid gap-10 px-14 md:grid-cols-[300px_minmax(0,760px)] md:gap-14">
        <MethodNav label={t("method.onThisPage")} sections={METHOD_SECTIONS.map(({ id, titleKey }) => ({ id, title: t(titleKey) }))} />
        {/* The space below lets the last sections scroll up to the reading position on tall screens. */}
        <div className="grid gap-20 border-rule md:border-l md:pb-[70vh] md:pl-14">
          {METHOD_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-[26px] font-light tracking-[-0.02em]">{t(section.titleKey)}</h2>
              <div className="mt-4 grid gap-3 text-base leading-[1.55] text-bone">
                {section.simpleKeys.map((key) => (
                  <p key={key}>{t(key)}</p>
                ))}
              </div>
              <details name="method-detail" className="group mt-6 border-t border-rule pt-4">
                <summary className="cursor-pointer text-sm text-ash transition-colors select-none hover:text-paper">
                  <span className="group-open:hidden">{t("method.showDetail")}</span>
                  <span className="hidden group-open:inline">{t("method.hideDetail")}</span>
                </summary>
                <div className="mt-5 grid gap-3 text-sm leading-[1.6] text-bone">
                  {section.detail.map((block, index) => (
                    <Block key={index} block={block} t={t} />
                  ))}
                  {section.references.length > 0 && (
                    <>
                      <h4 className="mt-4 text-sm font-medium text-paper">{t("method.references")}</h4>
                      <ol lang={referenceLang} className="grid list-decimal gap-1.5 pl-5 text-[13px] text-ash">
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
