using DispatchTrack.Api.Data.DAL;
using DispatchTrack.Api.Models;
using DispatchTrack.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/tripsheets")]
[Authorize]
public class TripSheetsController : ControllerBase
{
    private readonly ITripSheetDAL _tripSheetDAL;
    private readonly IPdfService _pdfService;

    public TripSheetsController(ITripSheetDAL tripSheetDAL, IPdfService pdfService)
    {
        _tripSheetDAL = tripSheetDAL;
        _pdfService = pdfService;
    }

    [HttpGet("open")]
    public async Task<ActionResult<List<TripSheet>>> GetOpen()
    {
        var tripSheets = await _tripSheetDAL.GetOpenAsync();
        return Ok(tripSheets);
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<TripSheet>> GetById(long id)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(id);
        if (tripSheet == null) return NotFound();
        return Ok(tripSheet);
    }

    [HttpGet("driver/{driverId:int}")]
    public async Task<ActionResult<List<TripSheet>>> GetByDriver(int driverId)
    {
        var tripSheets = await _tripSheetDAL.GetByDriverAsync(driverId);
        return Ok(tripSheets);
    }

    [HttpGet("{id:long}/pdf")]
    public async Task<IActionResult> GetPdf(long id)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(id);
        if (tripSheet == null) return NotFound();

        try
        {
            var pdfBytes = _pdfService.GenerateTripSheetPdf(tripSheet);
            var fileName = $"TripSheet_{tripSheet.TripNumber}.pdf";
            return File(pdfBytes, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to generate PDF", detail = ex.Message });
        }
    }
}