import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PaymentPanel from "../components/pos/PaymentPanel.tsx";

const basketItems = [
  { productId: 1, productName: "Test", unit: "ədəd", quantity: 2, salePrice: 50, minPrice: 30 },
  { productId: 2, productName: "Test 2", unit: "kq", quantity: 1, salePrice: 100, minPrice: 70 },
];

const defaultProps = {
  basket: basketItems,
  posMode: "sale" as const,
  isAdmin: true,
  isOnline: true,
  totalAmount: 200,
  totalCost: 130,
  profit: 70,
  marketplaceFee: 0,
  isCredit: false,
  customerMode: "none" as const,
  selectedCustomerId: "",
  customerLoyaltyPoints: 0,
  paymentType: "Nəğd",
  bankName: "",
  creditDueDate: "",
  notes: "",
  salesChannel: "Mağaza",
  applyEdv: false,
  returnStatus: "returned_to_stock" as const,
  cashReceivedInput: "",
  useLoyaltyPoints: false,
  loyaltyDiscountInput: "0",
  activeBanksList: ["Kapital Bank", "ABB"],
  activeSettings: { storeName: "Test Mağaza" },
  isSellingAtLoss: false,
  heldSales: [],
  createSalePending: false,
  createReturnPending: false,
  onPaymentType: vi.fn(),
  onBankName: vi.fn(),
  onCreditDueDate: vi.fn(),
  onNotes: vi.fn(),
  onSalesChannel: vi.fn(),
  onApplyEdv: vi.fn(),
  onReturnStatus: vi.fn(),
  onCashReceived: vi.fn(),
  onUseLoyaltyPoints: vi.fn(),
  onLoyaltyDiscountInput: vi.fn(),
  onCheckout: vi.fn(),
  onOpenHoldModal: vi.fn(),
  onOpenHeldList: vi.fn(),
  onPrintPickTicket: vi.fn(),
};

describe("PaymentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // === Basic rendering ===
  it("renders total amount", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("200.00 ₼")).toBeInTheDocument();
  });

  it("renders checkout button", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("Satışı Tamamla (Qaimə)")).toBeInTheDocument();
  });

  // === Profit / Loss ===
  it("shows profit for admin in sale mode", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText(/Təxmini Mənfəət/)).toBeInTheDocument();
    expect(screen.getByText("+70.00 ₼")).toBeInTheDocument();
  });

  it("shows loss warning when profit is negative", () => {
    render(<PaymentPanel {...defaultProps} profit={-20} />);
    expect(screen.getByText(/Təxmini Zərər/)).toBeInTheDocument();
  });

  it("does not show profit section when not admin", () => {
    render(<PaymentPanel {...defaultProps} isAdmin={false} />);
    expect(screen.queryByText("Məhsul mayası")).not.toBeInTheDocument();
  });

  // === Sales channel ===
  it("shows sale channel selector in sale mode", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("Satış Kanalı 🌐")).toBeInTheDocument();
  });

  it("calls onSalesChannel when channel changes", () => {
    const onChannel = vi.fn();
    render(<PaymentPanel {...defaultProps} onSalesChannel={onChannel} />);
    // Find the sales channel select by its label text and get the adjacent select
    const selects = screen.getAllByRole("combobox");
    const firstSelect = selects[0]; // First combobox is the sales channel
    fireEvent.change(firstSelect, { target: { value: "birmarket.az" } });
    expect(onChannel).toHaveBeenCalledWith("birmarket.az");
  });

  // === Hold / Held list / Pick ticket ===
  it("shows hold and held list buttons in sale mode", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("Saxla")).toBeInTheDocument();
    expect(screen.getByText("Saxlanmış")).toBeInTheDocument();
    expect(screen.getByText("📋 Yığım Bileti")).toBeInTheDocument();
  });

  it("disables hold button when basket is empty", () => {
    render(<PaymentPanel {...defaultProps} basket={[]} />);
    expect(screen.getByText("Saxla")).toBeDisabled();
  });

  it("enables hold button when basket has items", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("Saxla")).not.toBeDisabled();
  });

  it("calls onOpenHoldModal when hold button clicked", () => {
    const onHold = vi.fn();
    render(<PaymentPanel {...defaultProps} onOpenHoldModal={onHold} />);
    fireEvent.click(screen.getByText("Saxla"));
    expect(onHold).toHaveBeenCalled();
  });

  it("calls onOpenHeldList when held list button clicked", () => {
    const onList = vi.fn();
    render(<PaymentPanel {...defaultProps} onOpenHeldList={onList} />);
    fireEvent.click(screen.getByText("Saxlanmış"));
    expect(onList).toHaveBeenCalled();
  });

  it("calls onPrintPickTicket when pick ticket button clicked", () => {
    const onPrint = vi.fn();
    render(<PaymentPanel {...defaultProps} onPrintPickTicket={onPrint} />);
    fireEvent.click(screen.getByText("📋 Yığım Bileti"));
    expect(onPrint).toHaveBeenCalled();
  });

  // === Held sales badge ===
  it("shows held sales count badge when heldSales has items", () => {
    render(<PaymentPanel {...defaultProps} heldSales={[{ id: 1 }, { id: 2 }]} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show badge when heldSales is empty", () => {
    render(<PaymentPanel {...defaultProps} heldSales={[]} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  // === Payment methods ===
  it("shows payment method options", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("Nəğd")).toBeInTheDocument();
    expect(screen.getByText("Kart")).toBeInTheDocument();
    expect(screen.getByText("Kart2Kart")).toBeInTheDocument();
    expect(screen.getByText("Köçürmə")).toBeInTheDocument();
    expect(screen.getByText("Nisyə (Borc)")).toBeInTheDocument();
  });

  it("calls onPaymentType when payment changes", () => {
    const onPayment = vi.fn();
    render(<PaymentPanel {...defaultProps} onPaymentType={onPayment} />);
    const select = screen.getByDisplayValue("Nəğd");
    fireEvent.change(select, { target: { value: "Kart" } });
    expect(onPayment).toHaveBeenCalledWith("Kart");
  });

  // === Cash received ===
  it("shows cash received input when payment is Nəğd", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("Nəğd Qəbul Edildi")).toBeInTheDocument();
  });

  it("calls onCashReceived when cash input changes", () => {
    const onCash = vi.fn();
    render(<PaymentPanel {...defaultProps} onCashReceived={onCash} />);
    const cashInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(cashInput, { target: { value: "250" } });
    expect(onCash).toHaveBeenCalledWith("250");
  });

  it("shows change amount when cash entered is more than total", () => {
    render(<PaymentPanel {...defaultProps} cashReceivedInput="250" />);
    expect(screen.getByText(/Qaytarılacaq:/)).toBeInTheDocument();
    expect(screen.getByText("50.00 ₼")).toBeInTheDocument();
  });

  it("shows remaining amount when cash entered is less than total", () => {
    render(<PaymentPanel {...defaultProps} cashReceivedInput="150" />);
    expect(screen.getByText(/Çatmayan:/)).toBeInTheDocument();
  });

  it("does not show change when cash input is 0", () => {
    render(<PaymentPanel {...defaultProps} cashReceivedInput="" />);
    expect(screen.queryByText(/Qaytarılacaq:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Çatmayan:/)).not.toBeInTheDocument();
  });

  // === Bank selector ===
  it("shows bank selector when payment is Kart", () => {
    render(<PaymentPanel {...defaultProps} paymentType="Kart" />);
    expect(screen.getByText("Bank Hesabı *")).toBeInTheDocument();
    expect(screen.getByText("Kapital Bank")).toBeInTheDocument();
    expect(screen.getByText("ABB")).toBeInTheDocument();
  });

  it("does not show bank selector when payment is Nəğd", () => {
    render(<PaymentPanel {...defaultProps} paymentType="Nəğd" />);
    expect(screen.queryByText("Bank Hesabı *")).not.toBeInTheDocument();
  });

  it("calls onBankName when bank changes", () => {
    const onBank = vi.fn();
    render(<PaymentPanel {...defaultProps} paymentType="Kart" onBankName={onBank} />);
    const select = screen.getByDisplayValue("Bank Seçin...");
    fireEvent.change(select, { target: { value: "ABB" } });
    expect(onBank).toHaveBeenCalledWith("ABB");
  });

  // === Credit (Nisyə) ===
  it("shows credit due date when isCredit is true", () => {
    render(<PaymentPanel {...defaultProps} isCredit={true} />);
    expect(screen.getByText("Borcun Ödənilmə Tarixi *")).toBeInTheDocument();
  });

  it("shows nisyə checkout button text when isCredit is true", () => {
    render(<PaymentPanel {...defaultProps} isCredit={true} />);
    expect(screen.getByText("Nisye Satış Qeyd Et")).toBeInTheDocument();
  });

  it("calls onCreditDueDate when date changes", () => {
    const onDate = vi.fn();
    render(<PaymentPanel {...defaultProps} isCredit={true} onCreditDueDate={onDate} />);
    // Find the date input by type
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).not.toBeNull();
    if (dateInput) fireEvent.change(dateInput, { target: { value: "2026-08-15" } });
    expect(onDate).toHaveBeenCalledWith("2026-08-15");
  });

  // === Return mode ===
  it("shows return mode title", () => {
    render(<PaymentPanel {...defaultProps} posMode="return" />);
    expect(screen.getByText("Geri Qaytarış və Yekun")).toBeInTheDocument();
  });

  it("shows return status selector in return mode", () => {
    render(<PaymentPanel {...defaultProps} posMode="return" />);
    expect(screen.getByText("Qaytarış Tipi")).toBeInTheDocument();
    expect(screen.getByText("🟢 Anbara Geri Qayıtsın")).toBeInTheDocument();
    expect(screen.getByText("🔴 Deffekt / Zədəli")).toBeInTheDocument();
  });

  it("calls onReturnStatus when return type changes", () => {
    const onStatus = vi.fn();
    render(<PaymentPanel {...defaultProps} posMode="return" onReturnStatus={onStatus} />);
    const select = screen.getByDisplayValue("🟢 Anbara Geri Qayıtsın");
    fireEvent.change(select, { target: { value: "defective" } });
    expect(onStatus).toHaveBeenCalledWith("defective");
  });

  it("renders return checkout button text", () => {
    render(<PaymentPanel {...defaultProps} posMode="return" />);
    expect(screen.getByText("Geri Qaytarlışı Tamamla")).toBeInTheDocument();
  });

  it("shows return payment method selector without Nisyə option", () => {
    render(<PaymentPanel {...defaultProps} posMode="return" />);
    expect(screen.queryByText("Nisyə (Borc)")).not.toBeInTheDocument();
  });

  // === Checkout button ===
  it("disables checkout button when basket is empty", () => {
    render(<PaymentPanel {...defaultProps} basket={[]} />);
    expect(screen.getByRole("button", { name: /Satışı Tamamla/ })).toBeDisabled();
  });

  it("enables checkout button when basket has items", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Satışı Tamamla/ })).not.toBeDisabled();
  });

  it("disables checkout button when createSalePending is true", () => {
    render(<PaymentPanel {...defaultProps} createSalePending={true} />);
    expect(screen.getByRole("button", { name: /Satışı Tamamla/ })).toBeDisabled();
  });

  it("disables checkout button when createReturnPending is true", () => {
    render(<PaymentPanel {...defaultProps} posMode="return" createReturnPending={true} />);
    expect(screen.getByRole("button", { name: /Geri Qaytarlışı Tamamla/ })).toBeDisabled();
  });

  it("calls onCheckout when checkout button clicked", () => {
    const onCheckout = vi.fn();
    render(<PaymentPanel {...defaultProps} onCheckout={onCheckout} />);
    fireEvent.click(screen.getByText("Satışı Tamamla (Qaimə)"));
    expect(onCheckout).toHaveBeenCalled();
  });

  // === Cost breakdown ===
  it("shows cost breakdown for admin", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByText("Məhsul mayası")).toBeInTheDocument();
    expect(screen.getByText("130.00 ₼")).toBeInTheDocument();
  });

  // === Notes ===
  it("shows notes input", () => {
    render(<PaymentPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText("Əlavə məlumat (ixtiyari)")).toBeInTheDocument();
  });

  it("calls onNotes when notes change", () => {
    const onNotes = vi.fn();
    render(<PaymentPanel {...defaultProps} onNotes={onNotes} />);
    const notesInput = screen.getByPlaceholderText("Əlavə məlumat (ixtiyari)");
    fireEvent.change(notesInput, { target: { value: "Test qeyd" } });
    expect(onNotes).toHaveBeenCalledWith("Test qeyd");
  });

  // === Loyalty points ===
  it("shows loyalty bonus discount when useLoyaltyPoints is true", () => {
    render(<PaymentPanel {...defaultProps} useLoyaltyPoints={true} loyaltyDiscountInput="10" />);
    expect(screen.getByText("Bonus Güzəşti")).toBeInTheDocument();
    expect(screen.getByText("-10.00 ₼")).toBeInTheDocument();
  });

  it("shows final total after loyalty discount", () => {
    render(<PaymentPanel {...defaultProps} useLoyaltyPoints={true} loyaltyDiscountInput="10" />);
    expect(screen.getByText("Ödəniləcək Yekun")).toBeInTheDocument();
    expect(screen.getByText("190.00 ₼")).toBeInTheDocument();
  });

  it("does not show loyalty discount when discount is 0", () => {
    render(<PaymentPanel {...defaultProps} useLoyaltyPoints={true} loyaltyDiscountInput="0" />);
    expect(screen.queryByText("Bonus Güzəşti")).not.toBeInTheDocument();
  });

  it("does not show loyalty section when useLoyaltyPoints is false", () => {
    render(<PaymentPanel {...defaultProps} useLoyaltyPoints={false} />);
    expect(screen.queryByText("Bonus Güzəşti")).not.toBeInTheDocument();
  });
});
