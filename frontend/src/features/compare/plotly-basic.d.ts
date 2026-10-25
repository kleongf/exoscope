// The basic Plotly bundle (scatter, bar, pie) has the same API as plotly.js at a fraction of the size.
declare module "plotly.js-basic-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}
