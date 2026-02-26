/** Set global Prism so prismjs component imports can register languages. Must run before any prismjs/components imports. */
import { Prism } from "prism-react-renderer";

const g = typeof global !== "undefined" ? global : window;
g.Prism = Prism;
