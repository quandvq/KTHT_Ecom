namespace Ktht.Application;

public sealed record ReturnLine(int OrderItemId, int Quantity);

/// <summary>
/// Chính sách đổi trả MVP (TASK-010, AGENTS §8): chỉ hỗ trợ trả toàn bộ đơn đã giao.
/// Yêu cầu phải có đúng một dòng cho mỗi dòng đơn, với số lượng bằng số lượng đã giao;
/// không có dòng trùng, dòng lạ hay số lượng khác. Trả một phần bị từ chối rõ ràng.
/// </summary>
public static class ReturnPolicy
{
    public const string FullOrderOnlyMessage = "Bản demo chỉ hỗ trợ trả toàn bộ đơn: yêu cầu phải gồm mỗi dòng hàng đúng một lần với đủ số lượng đã giao.";

    public static string? ValidateFullOrder(IReadOnlyCollection<ReturnLine> delivered, IReadOnlyCollection<ReturnLine> requested)
    {
        if (requested.Count == 0 || requested.Any(line => line.Quantity <= 0))
            return "Yêu cầu đổi trả phải có ít nhất một dòng hàng với số lượng dương.";

        if (requested.GroupBy(line => line.OrderItemId).Any(group => group.Count() > 1))
            return "Mỗi dòng hàng chỉ được xuất hiện một lần trong yêu cầu đổi trả.";

        var deliveredById = delivered.ToDictionary(line => line.OrderItemId, line => line.Quantity);
        if (requested.Any(line => !deliveredById.ContainsKey(line.OrderItemId)))
            return "Yêu cầu đổi trả chứa dòng hàng không thuộc đơn.";

        if (requested.Count != deliveredById.Count || requested.Any(line => line.Quantity != deliveredById[line.OrderItemId]))
            return FullOrderOnlyMessage;

        return null;
    }
}
