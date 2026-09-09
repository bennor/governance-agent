import { defineSandbox } from "eve/sandbox";

export default defineSandbox(({ parent }) => {
  if (parent === null) {
    throw new Error("drafter must run as a child of an agent with an active sandbox");
  }
  return parent.sandbox;
});
