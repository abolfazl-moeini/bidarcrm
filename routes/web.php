<?php

use App\Http\Controllers\ContactViewController;
use App\Http\Controllers\DealViewController;
use Illuminate\Support\Facades\Route;

Route::get('/', [DealViewController::class, 'index'])->name('home');
Route::get('/deals', [DealViewController::class, 'index'])->name('deals.kanban');
Route::get('/contacts', [ContactViewController::class, 'index'])->name('contacts.index');
Route::get('/contacts/{contact}', [ContactViewController::class, 'show'])->name('contacts.show');
