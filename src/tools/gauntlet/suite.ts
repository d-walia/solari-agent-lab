/**
 * Gauntlet suite — the tasks we run an agent through, many times each.
 *
 * Target: saucedemo.com, a site built expressly for test automation (published
 * demo credentials, no ToS or bot-detection grey area). The success checks are
 * unfakeable: you either reach the order-complete page or you don't.
 *
 * Variants deliberately span easy → hard so the reliability distribution has
 * range: problem_user has broken UI, performance_glitch_user is artificially
 * slow. A brittle agent will pass "standard" and fall apart on those.
 */
export interface Task {
  id: string;
  label: string;
  sub: string;
  url: string;
  goal: string;
  check: (page: any) => Promise<boolean>;
}

const reachedConfirmation = async (page: any): Promise<boolean> => {
  try {
    if (/checkout-complete/.test(page.url())) return true;
    const html = await page.content();
    return html.includes("Thank you for your order");
  } catch {
    return false;
  }
};

const START = "https://www.saucedemo.com/";
const SHIP = "use First name Test, Last name User, Zip 90210";

export const suite: Task[] = [
  {
    id: "standard-checkout",
    label: "Standard checkout",
    sub: "standard_user",
    url: START,
    goal: `Log in as user "standard_user" with password "secret_sauce". Add the "Sauce Labs Backpack" to the cart, go to the cart, check out (${SHIP}), and finish the order. Finish only when you see the order-complete confirmation.`,
    check: reachedConfirmation,
  },
  {
    id: "two-item-cart",
    label: "Two-item checkout",
    sub: "standard_user",
    url: START,
    goal: `Log in as "standard_user" / "secret_sauce". Add BOTH the "Sauce Labs Backpack" and the "Sauce Labs Bike Light" to the cart, then check out (${SHIP}) and complete the order. Finish only at the order-complete confirmation.`,
    check: reachedConfirmation,
  },
  {
    id: "broken-image-user",
    label: "Broken-image account",
    sub: "problem_user",
    url: START,
    goal: `Log in as "problem_user" / "secret_sauce". Add the "Sauce Labs Backpack" to the cart and complete checkout (${SHIP}). Note: this account has broken images and glitchy controls. Finish only at the order-complete confirmation.`,
    check: reachedConfirmation,
  },
  {
    id: "slow-network-user",
    label: "Slow-network account",
    sub: "performance_glitch_user",
    url: START,
    goal: `Log in as "performance_glitch_user" / "secret_sauce". Add the "Sauce Labs Backpack" to the cart and complete checkout (${SHIP}). This account is slow, so wait for pages to settle. Finish only at the order-complete confirmation.`,
    check: reachedConfirmation,
  },
];
