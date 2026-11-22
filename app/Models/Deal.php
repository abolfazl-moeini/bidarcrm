<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deal extends Model
{
    use HasFactory;

    protected $fillable = [
        'pipeline_id',
        'stage_id',
        'title',
        'amount',
        'status',
        'win_probability',
        'stage_entered_at',
        'days_in_stage',
        'last_activity_at',
        'is_rotten',
        'assigned_user_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'win_probability' => 'integer',
            'stage_entered_at' => 'datetime',
            'days_in_stage' => 'integer',
            'last_activity_at' => 'datetime',
            'is_rotten' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Deal $deal): void {
            if (is_null($deal->stage_entered_at)) {
                $deal->stage_entered_at = Carbon::now();
            }
            if (is_null($deal->last_activity_at)) {
                $deal->last_activity_at = Carbon::now();
            }
        });
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(Pipeline::class);
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }
}
