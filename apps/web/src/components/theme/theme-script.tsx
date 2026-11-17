import { THEME_STORAGE_KEY } from "@/lib/brand";

/**
 * Roda antes da primeira pintura: aplica a classe "dark" conforme a preferência salva
 * (ou a do sistema), evitando o flash de tema errado.
 */
const script = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.dataset.theme=p;}catch(e){document.documentElement.classList.add("dark");}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
