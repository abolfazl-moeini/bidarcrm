<?php

use App\Http\Controllers\DealViewController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/deals', [DealViewController::class, 'index'])->name('deals.kanban');
