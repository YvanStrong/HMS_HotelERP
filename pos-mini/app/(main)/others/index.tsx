import { HubLink } from '../../../src/components/HubLink';
import { ScreenContainer } from '../../../src/components/ScreenContainer';

export default function OthersHubScreen() {
  return (
    <ScreenContainer scroll>
      <HubLink label="Customers" href="/(main)/others/customers" subtitle="Manage customer records and credit" />
      <HubLink label="Suppliers" href="/(main)/others/suppliers" subtitle="Supplier contacts for purchases" />
      <HubLink label="Expenses" href="/(main)/others/expenses" subtitle="Track business expenses by category" />
      <HubLink label="Discounts & promos" href="/(main)/settings/discounts" subtitle="Discount rules and promo codes" />
      <HubLink label="Debt tracker" href="/(main)/others/debts" subtitle="Customer credit and supplier balances" />
    </ScreenContainer>
  );
}
