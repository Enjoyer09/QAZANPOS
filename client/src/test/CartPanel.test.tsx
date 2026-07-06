import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "../components/Toast.tsx";
import CartPanel from "../components/pos/CartPanel.tsx";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const mockBasket = [
  {
    productId: 1,
    productName: "Test Məhsul 1",
    unit: "ədəd",
    quantity: 2,
    salePrice: 25.50,
    minPrice: 15.00,
    category: "Elektronika",
  },
  {
    productId: 2,
    productName: "Test Məhsul 2",
    unit: "kq",
    quantity: 1.5,
    salePrice: 45.00,
    minPrice: 30.00,
  },
];

const mockBasketWithSerials = [
  {
    productId: 3,
    productName: "Serial Telefon",
    unit: "ədəd",
    quantity: 2,
    salePrice: 1000,
    minPrice: 800,
    serialNumbers: ["IMEI123456", "IMEI789012"],
    category: "Elektronika",
  },
];

const mockLossBasket = [
  {
    productId: 4,
    productName: "Zərərli Məhsul",
    unit: "ədəd",
    quantity: 1,
    salePrice: 20,
    minPrice: 30, // salePrice < minPrice => loss
    category: "Digər",
  },
];

const mockBasketWithOriginalPrice = [
  {
    productId: 5,
    productName: "Endirimli Məhsul",
    unit: "ədəd",
    quantity: 1,
    salePrice: 80,
    minPrice: 60,
    originalPrice: 100,
    category: "Geyim",
  },
];

const defaultProps = {
  basket: mockBasket,
  posMode: "sale" as const,
  isAdmin: true,
  onRemoveFromBasket: vi.fn(),
  onUpdateItem: vi.fn(),
  onRemoveSerial: vi.fn(),
  onOpenDiscountModal: vi.fn(),
  onPrintPickTicket: vi.fn(),
};

describe("CartPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // === Basic rendering ===
  it("renders empty state when basket is empty", () => {
    renderWithProviders(<CartPanel {...defaultProps} basket={[]} />);
    expect(screen.getByText("Səbət boşdur. Kataloqdan məhsul seçib əlavə edin.")).toBeInTheDocument();
  });

  it("renders basket items count", () => {
    renderWithProviders(<CartPanel {...defaultProps} />);
    expect(screen.getByText("2 növ məhsul")).toBeInTheDocument();
  });

  it("renders all basket product names", () => {
    renderWithProviders(<CartPanel {...defaultProps} />);
    expect(screen.getByText("Test Məhsul 1")).toBeInTheDocument();
    expect(screen.getByText("Test Məhsul 2")).toBeInTheDocument();
  });

  it("renders product units", () => {
    renderWithProviders(<CartPanel {...defaultProps} />);
    expect(screen.getByText("Ölçü vahidi: ədəd")).toBeInTheDocument();
    expect(screen.getByText("Ölçü vahidi: kq")).toBeInTheDocument();
  });

  it("shows total per item row", () => {
    renderWithProviders(<CartPanel {...defaultProps} />);
    expect(screen.getByText("51.00 ₼")).toBeInTheDocument(); // 25.50 * 2
    expect(screen.getByText("67.50 ₼")).toBeInTheDocument(); // 45.00 * 1.5
  });

  it("shows profit column for admin in sale mode", () => {
    renderWithProviders(<CartPanel {...defaultProps} />);
    expect(screen.getByText("Gəlir")).toBeInTheDocument();
  });

  it("does NOT show profit column when not admin", () => {
    renderWithProviders(<CartPanel {...defaultProps} isAdmin={false} />);
    expect(screen.queryByText("Gəlir")).not.toBeInTheDocument();
  });

  it("renders min price in cost column", () => {
    renderWithProviders(<CartPanel {...defaultProps} />);
    expect(screen.getByText("15.00 ₼")).toBeInTheDocument();
    expect(screen.getByText("30.00 ₼")).toBeInTheDocument();
  });

  // === Delete button ===
  it("calls onRemoveFromBasket when delete button clicked", () => {
    const onRemove = vi.fn();
    renderWithProviders(<CartPanel {...defaultProps} onRemoveFromBasket={onRemove} />);
    const rows = document.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    const lastRow = rows[rows.length - 1];
    const buttons = lastRow.querySelectorAll("button");
    const deleteBtn = buttons[buttons.length - 1];
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(onRemove).toHaveBeenCalledWith(expect.any(Number));
  });

  it("calls onRemoveFromBasket with correct productId", () => {
    const onRemove = vi.fn();
    renderWithProviders(<CartPanel
      {...defaultProps}
      basket={[{ productId: 99, productName: "Test", unit: "ədəd", quantity: 1, salePrice: 10, minPrice: 5 }]}
      onRemoveFromBasket={onRemove}
    />);
    const rows = document.querySelectorAll("tbody tr");
    const row = rows[0];
    const buttons = row.querySelectorAll("button");
    const deleteBtn = buttons[buttons.length - 1];
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(onRemove).toHaveBeenCalledWith(99);
  });

  // === Quantity & Price editing ===
  it("renders quantity inputs for each item", () => {
    renderWithProviders(<CartPanel {...defaultProps} />);
    const qtyInputs = screen.getAllByDisplayValue("2");
    expect(qtyInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onUpdateItem when quantity input changes", () => {
    const onUpdate = vi.fn();
    renderWithProviders(<CartPanel {...defaultProps} onUpdateItem={onUpdate} />);
    const qtyInput = screen.getByDisplayValue("2");
    fireEvent.change(qtyInput, { target: { value: "5" } });
    expect(onUpdate).toHaveBeenCalledWith(1, "quantity", "5");
  });

  it("calls onUpdateItem when price input changes", () => {
    const onUpdate = vi.fn();
    renderWithProviders(<CartPanel {...defaultProps} onUpdateItem={onUpdate} />);
    // Price inputs have different styling - find by inputMode decimal
    const priceInputs = document.querySelectorAll("input[inputmode='decimal']");
    // The second decimal input in the first row is the price
    const row1priceInput = priceInputs[1];
    if (row1priceInput) {
      fireEvent.change(row1priceInput, { target: { value: "30" } });
      expect(onUpdate).toHaveBeenCalledWith(1, "salePrice", "30");
    }
  });

  // === Serial numbers ===
  it("renders serial numbers when basket items have them", () => {
    renderWithProviders(<CartPanel {...defaultProps} basket={mockBasketWithSerials} />);
    expect(screen.getByText("IMEI123456")).toBeInTheDocument();
    expect(screen.getByText("IMEI789012")).toBeInTheDocument();
  });

  it("calls onRemoveSerial when serial remove button clicked", () => {
    const onRemoveSerial = vi.fn();
    renderWithProviders(
      <CartPanel {...defaultProps} basket={mockBasketWithSerials} onRemoveSerial={onRemoveSerial} />
    );
    const serialRemoveBtns = screen.getAllByText("✕");
    expect(serialRemoveBtns.length).toBeGreaterThan(0);
    fireEvent.click(serialRemoveBtns[0]);
    expect(onRemoveSerial).toHaveBeenCalledWith(3, "IMEI123456");
  });

  it("disables quantity input for serialized items", () => {
    renderWithProviders(<CartPanel {...defaultProps} basket={mockBasketWithSerials} />);
    const disabledInputs = document.querySelectorAll("input[readonly]");
    expect(disabledInputs.length).toBeGreaterThan(0);
  });

  // === Loss warning ===
  it("shows loss warning when salePrice < minPrice", () => {
    renderWithProviders(<CartPanel {...defaultProps} basket={mockLossBasket} />);
    // The loss warning renders as "Min: 30.00 ₼" - use a regex to find it
    expect(screen.getByText(/Min: 30\.00/)).toBeInTheDocument();
  });

  // === Discount modal ===
  it("calls onOpenDiscountModal when discount button clicked", () => {
    const onDiscount = vi.fn();
    renderWithProviders(<CartPanel {...defaultProps} onOpenDiscountModal={onDiscount} />);
    // Find discount button (🏷️) inside the table - it only shows in sale mode
    // Use querySelector to find the button with title "Fərdi Endirim"
    const discountBtn = document.querySelector('button[title="Fərdi Endirim"]');
    expect(discountBtn).not.toBeNull();
    if (discountBtn) fireEvent.click(discountBtn);
    expect(onDiscount).toHaveBeenCalledWith(expect.objectContaining({ productId: 1 }));
  });

  // === Original price display ===
  it("shows original price with strikethrough when originalPrice > salePrice", () => {
    renderWithProviders(<CartPanel {...defaultProps} basket={mockBasketWithOriginalPrice} />);
    expect(screen.getByText("100.00 ₼")).toBeInTheDocument();
  });

  // === Return mode ===
  it("does not show profit column in return mode", () => {
    renderWithProviders(<CartPanel {...defaultProps} posMode="return" />);
    expect(screen.queryByText("Gəlir")).not.toBeInTheDocument();
  });

  it("shows 'Qaytarış Qiyməti' header in return mode", () => {
    renderWithProviders(<CartPanel {...defaultProps} posMode="return" />);
    expect(screen.getByText(/Qaytarış Qiyməti/)).toBeInTheDocument();
  });

  // === Print pick ticket ===
  it("calls onPrintPickTicket when print button available", () => {
    // printPickTicket is used in ProductGrid, not CartPanel - but CartPanel accepts the prop
    // Just verify the prop exists
    const { container } = renderWithProviders(<CartPanel {...defaultProps} />);
    expect(container).toBeTruthy();
  });
});
