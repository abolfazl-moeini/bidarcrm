<?php

use App\Http\Controllers\Api\DealController;
use App\Http\Controllers\Api\PipelineController;
use Illuminate\Support\Facades\Route;

Route::prefix('pipelines')->group(function () {
    Route::get('/', [PipelineController::class, 'index']);
    Route::post('/', [PipelineController::class, 'store']);
});

Route::prefix('deals')->group(function () {
    Route::get('/', [DealController::class, 'index']);
    Route::post('/', [DealController::class, 'store']);
    Route::post('/{id}/move', [DealController::class, 'move']);
});
