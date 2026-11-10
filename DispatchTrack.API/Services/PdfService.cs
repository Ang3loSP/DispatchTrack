using DinkToPdf;
using DinkToPdf.Contracts;
using DispatchTrack.Api.Models;

namespace DispatchTrack.Api.Services;

public interface IPdfService
{
    byte[] GenerateTripSheetPdf(TripSheet tripSheet);
}

public class PdfService : IPdfService
{
    private readonly IConverter _converter;

    public PdfService(IConverter converter)
    {
        _converter = converter;
    }

    public byte[] GenerateTripSheetPdf(TripSheet tripSheet)
    {
        var html = BuildTripSheetHtml(tripSheet);

        var doc = new HtmlToPdfDocument()
        {
            GlobalSettings = new GlobalSettings
            {
                ColorMode = ColorMode.Color,
                Orientation = Orientation.Portrait,
                PaperSize = PaperKind.A4,
                Margins = new MarginSettings { Top = 15, Bottom = 15, Left = 15, Right = 15 },
                DocumentTitle = $"TripSheet_{tripSheet.TripNumber}",
            },
            Objects = {
                new ObjectSettings
                {
                    HtmlContent = html,
                    WebSettings = { DefaultEncoding = "utf-8" },
                }
            }
        };

        return _converter.Convert(doc);
    }

    private string BuildTripSheetHtml(TripSheet tripSheet)
    {
        var statusLabels = new[] { "Created", "In Progress", "Returned", "Complete", "Cancelled" };
        var status = tripSheet.Status >= 0 && tripSheet.Status < statusLabels.Length ? statusLabels[tripSheet.Status] : "Unknown";

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html>");
        sb.AppendLine("<head>");
        sb.AppendLine("<meta charset='utf-8' />");
        sb.AppendLine("<style>");
        sb.AppendLine(GetStyles());
        sb.AppendLine("</style>");
        sb.AppendLine("</head>");
        sb.AppendLine("<body>");

        // Header
        sb.AppendLine("<div class='header'>");
        sb.AppendLine($"  <h1>Trip Sheet: {tripSheet.TripNumber}</h1>");
        sb.AppendLine($"  <div class='meta'>");
        sb.AppendLine($"    <span class='status status-{tripSheet.Status.ToString().ToLower()}'>Status: {status}</span>");
        sb.AppendLine($"    <span>Driver: {tripSheet.DriverName}</span>");
        sb.AppendLine($"    <span>Category: {tripSheet.DispatchDestinationCategory ?? "N/A"}</span>");
        sb.AppendLine($"  </div>");
        sb.AppendLine("</div>");

        // Trip Info
        sb.AppendLine("<div class='section'>");
        sb.AppendLine("  <h2>Trip Information</h2>");
        sb.AppendLine("  <table class='info-table'>");
        sb.AppendLine($"    <tr><th>Trip Number</th><td>{tripSheet.TripNumber}</td></tr>");
        sb.AppendLine($"    <tr><th>Status</th><td>{status}</td></tr>");
        sb.AppendLine($"    <tr><th>Driver</th><td>{tripSheet.DriverName}</td></tr>");
        sb.AppendLine($"    <tr><th>Category</th><td>{tripSheet.DispatchDestinationCategory ?? "N/A"}</td></tr>");
        sb.AppendLine($"    <tr><th>Start Time</th><td>{FormatDateTime(tripSheet.TripStartDateTime)}</td></tr>");
        sb.AppendLine($"    <tr><th>End Time</th><td>{FormatDateTime(tripSheet.TripEndDateTime)}</td></tr>");
        sb.AppendLine($"    <tr><th>Created</th><td>{FormatDateTime(tripSheet.CreatedAt)}</td></tr>");
        sb.AppendLine("  </table>");
        sb.AppendLine("</div>");

        // Stops
        sb.AppendLine("<div class='section'>");
        sb.AppendLine($"  <h2>Stops ({tripSheet.Items?.Count ?? 0})</h2>");
        if (tripSheet.Items != null && tripSheet.Items.Count > 0)
        {
            sb.AppendLine("  <table class='stops-table'>");
            sb.AppendLine("    <thead>");
            sb.AppendLine("      <tr>");
            sb.AppendLine("        <th>#</th>");
            sb.AppendLine("        <th>Pickup Address</th>");
            sb.AppendLine("        <th>Dropoff Address</th>");
            sb.AppendLine("        <th>Status</th>");
            sb.AppendLine("        <th>Notes</th>");
            sb.AppendLine("        <th>Delivered</th>");
            sb.AppendLine("        <th>POD</th>");
            sb.AppendLine("      </tr>");
            sb.AppendLine("    </thead>");
            sb.AppendLine("    <tbody>");

            var sortedItems = tripSheet.Items.OrderBy(i => i.StopNumber).ToList();
            foreach (var item in sortedItems)
            {
                var jobStatus = item.Job?.Status.ToString() ?? "N/A";
                var jobStatusClass = GetStatusClass(jobStatus);
                
                sb.AppendLine("      <tr>");
                sb.AppendLine($"        <td class='stop-number'>{item.StopNumber}</td>");
                sb.AppendLine($"        <td>{item.Job?.PickupAddress ?? "N/A"}</td>");
                sb.AppendLine($"        <td>{item.Job?.DropoffAddress ?? "N/A"}</td>");
                sb.AppendLine($"        <td><span class='status-badge {jobStatusClass}'>{jobStatus}</span></td>");
                sb.AppendLine($"        <td>{item.NonTicketDescription ?? "-"}</td>");
                sb.AppendLine("        <td><input type='checkbox' class='check-delivered' /></td>");
                sb.AppendLine("        <td><input type='checkbox' class='check-pod' /></td>");
                sb.AppendLine("      </tr>");
            }

            sb.AppendLine("    </tbody>");
            sb.AppendLine("  </table>");
        }
        else
        {
            sb.AppendLine("  <p class='no-stops'>No stops assigned to this trip sheet.</p>");
        }
        sb.AppendLine("</div>");

        // Signature section
        sb.AppendLine("<div class='section signature-section'>");
        sb.AppendLine("  <h2>Signatures</h2>");
        sb.AppendLine("  <table class='signature-table'>");
        sb.AppendLine("    <tr>");
        sb.AppendLine("      <td class='sig-block'>");
        sb.AppendLine("        <div class='sig-line'></div>");
        sb.AppendLine("        <div class='sig-label'>Driver Signature</div>");
        sb.AppendLine("      </td>");
        sb.AppendLine("      <td class='sig-block'>");
        sb.AppendLine("        <div class='sig-line'></div>");
        sb.AppendLine("        <div class='sig-label'>Dispatcher Signature</div>");
        sb.AppendLine("      </td>");
        sb.AppendLine("    </tr>");
        sb.AppendLine("    <tr>");
        sb.AppendLine("      <td class='sig-block'>");
        sb.AppendLine("        <div class='sig-line'></div>");
        sb.AppendLine("        <div class='sig-label'>Date</div>");
        sb.AppendLine("      </td>");
        sb.AppendLine("      <td class='sig-block'>");
        sb.AppendLine("        <div class='sig-line'></div>");
        sb.AppendLine("        <div class='sig-label'>Date</div>");
        sb.AppendLine("      </td>");
        sb.AppendLine("    </tr>");
        sb.AppendLine("  </table>");
        sb.AppendLine("</div>");

        sb.AppendLine("</body>");
        sb.AppendLine("</html>");

        return sb.ToString();
    }

    private string GetStyles()
    {
        return @"
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            body { margin: 0; padding: 20px; font-size: 11px; color: #1a1a2e; line-height: 1.4; }
            .header { border-bottom: 2px solid #ff4d00; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 8px 0; font-size: 22px; color: #0a0e17; }
            .meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 11px; }
            .meta span { background: #f0f4f8; padding: 4px 10px; border-radius: 4px; }
            .status { font-weight: 600; text-transform: uppercase; font-size: 10px; }
            .status-created { color: #3d5a7a; }
            .status-inprogress { color: #d97706; }
            .status-returned { color: #0284c7; }
            .status-complete { color: #059669; }
            .status-cancelled { color: #dc2626; }
            .section { margin-bottom: 20px; }
            .section h2 { font-size: 13px; color: #0a0e17; border-bottom: 1px solid #b3d4f0; padding-bottom: 4px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; }
            th { background: #d6eaf8; color: #0a0e17; font-weight: 600; }
            .info-table th { width: 30%; background: #f8fafc; }
            .stops-table th { background: #d6eaf8; }
            .stop-number { font-weight: 700; text-align: center; width: 40px; }
            .status-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
            .status-badge.pending { background: #b3d4f0; color: #3d5a7a; }
            .status-badge.assigned { background: #fed7aa; color: #c2410c; }
            .status-badge.intransit { background: #fde68a; color: #b45309; }
            .status-badge.delivered { background: #bbf7d0; color: #059669; }
            .status-badge.failed { background: #fecaca; color: #dc2626; }
            .check-delivered, .check-pod { width: 16px; height: 16px; accent-color: #ff4d00; }
            .no-stops { color: #8b9cb3; font-style: italic; text-align: center; padding: 20px; }
            .signature-section { margin-top: 30px; page-break-inside: avoid; }
            .signature-table { width: 100%; border: none; }
            .signature-table td { border: none; padding: 0; vertical-align: top; }
            .sig-block { text-align: center; }
            .sig-line { border-top: 1px solid #3d5a7a; width: 200px; margin: 0 auto 4px; height: 40px; }
            .sig-label { font-size: 9px; color: #8b9cb3; }
            @media print { body { padding: 0; } .no-print { display: none; } }
        ";
    }

    private string FormatDateTime(DateTime? dt)
    {
        return dt?.ToString("yyyy-MM-dd HH:mm") ?? "—";
    }

    private string GetStatusClass(string status)
    {
        return status.ToLower() switch
        {
            "pending" => "pending",
            "assigned" => "assigned",
            "intransit" => "intransit",
            "delivered" => "delivered",
            "failed" => "failed",
            _ => "pending"
        };
    }
}