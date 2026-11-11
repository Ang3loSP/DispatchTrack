using DispatchTrack.Api.Data.DAL;
using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/tripsheets")]
[Authorize]
public class TripSheetsController : ControllerBase
{
    private readonly ITripSheetDAL _tripSheetDAL;

    public TripSheetsController(ITripSheetDAL tripSheetDAL)
    {
        _tripSheetDAL = tripSheetDAL;
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
}